/* Gemelo Digital CD · cuentas de usuario y guardado en la nube (Supabase) */
(function () {
  "use strict";
  const TABLA = "gemelo_estado";
  const $ = s => document.querySelector(s);
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let sb = null, user = null, lastJson = null, saving = false, loading = false, timer = null, lastSaved = null;

  /* ---------- estilos ---------- */
  const css = document.createElement("style");
  css.textContent = `
  .nb-gate{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:16px;background:rgba(19,28,38,.55);backdrop-filter:blur(6px)}
  .nb-gate[hidden]{display:none}
  .nb-card{width:min(400px,100%);display:grid;gap:12px;padding:26px 24px 22px;background:#fff;border-radius:18px;box-shadow:0 24px 60px rgba(19,35,56,.3);font-family:var(--f-body)}
  .nb-card h2{margin:0;font:800 21px/1.2 var(--f-body);letter-spacing:-.01em}
  .nb-card h2 em{font-style:normal;color:var(--accent)}
  .nb-card p{margin:0;font-size:13px;color:var(--muted)}
  .nb-card label{display:grid;gap:4px;font-size:12.5px;font-weight:600;color:var(--fg)}
  .nb-card input{width:100%;padding:10px 12px;border:1px solid var(--line2);border-radius:10px;font-size:14px;background:#fff}
  .nb-card input:focus{outline:2px solid var(--accent);outline-offset:1px}
  .nb-card .btn.primary{justify-content:center;padding:10px 12px;font-size:14px}
  .nb-links{display:flex;flex-wrap:wrap;justify-content:space-between;gap:6px}
  .nb-links button{padding:0;border:0;background:none;color:var(--accent);font-size:12.5px;font-weight:600;cursor:pointer}
  .nb-msg{font-size:12.5px;min-height:1em}
  .nb-msg.err{color:var(--crit)} .nb-msg.ok{color:var(--ok)}
  .nb-user{display:flex;align-items:center;gap:8px;padding:4px 4px 4px 10px;border:1px solid var(--line);border-radius:10px;font-size:12px;min-width:0}
  .nb-user .nb-st{display:flex;align-items:center;gap:5px;color:var(--muted);white-space:nowrap}
  .nb-user .nb-st i{width:7px;height:7px;border-radius:50%;background:var(--ok)}
  .nb-user .nb-st.saving i{background:var(--warn)} .nb-user .nb-st.err i{background:var(--crit)}
  .nb-user .nb-mail{max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700}
  @media (max-width:980px){.nb-user .nb-mail{display:none}}`;
  document.head.appendChild(css);

  /* ---------- pantalla de ingreso ---------- */
  const gate = document.createElement("div");
  gate.className = "nb-gate";
  gate.hidden = true;
  document.body.appendChild(gate);
  let mode = "in";
  const TXT = {
    in: { t: "Ingresar", s: "Entrá con tu email y contraseña para ver y editar tu centro de distribución.", b: "Ingresar" },
    up: { t: "Crear cuenta", s: "Cada cuenta guarda su propia configuración, inventario, pedidos, escenarios y simulación de ahorro.", b: "Crear cuenta" },
    reset: { t: "Recuperar contraseña", s: "Te mandamos un email con un enlace para elegir una contraseña nueva.", b: "Enviar enlace" },
    newpw: { t: "Nueva contraseña", s: "Elegí la contraseña nueva para tu cuenta.", b: "Guardar contraseña" }
  };
  function renderGate(msg, kind) {
    const T = TXT[mode];
    gate.innerHTML = `<form class="nb-card" novalidate>
      <h2>Gemelo Digital <em>CD</em></h2>
      <div><b style="font-size:15px">${T.t}</b><p>${T.s}</p></div>
      ${mode !== "newpw" ? `<label>Email<input type="email" name="email" autocomplete="email" required></label>` : ""}
      ${mode === "in" || mode === "up" || mode === "newpw" ? `<label>Contraseña<input type="password" name="pw" autocomplete="${mode === "in" ? "current-password" : "new-password"}" minlength="6" required></label>` : ""}
      ${mode === "up" || mode === "newpw" ? `<label>Repetir contraseña<input type="password" name="pw2" autocomplete="new-password" minlength="6" required></label>` : ""}
      <button class="btn primary" type="submit">${T.b}</button>
      <p class="nb-msg ${kind || ""}" aria-live="polite">${esc(msg || "")}</p>
      <div class="nb-links">${mode === "in" ? `<button type="button" data-m="up">Crear una cuenta</button><button type="button" data-m="reset">Olvidé mi contraseña</button>` : mode === "newpw" ? "" : `<button type="button" data-m="in">Ya tengo cuenta: ingresar</button>`}</div>
    </form>`;
    const f = gate.querySelector("input");
    if (f) setTimeout(() => f.focus(), 30);
  }
  gate.addEventListener("click", e => { const b = e.target.closest("[data-m]"); if (b) { mode = b.dataset.m; renderGate(); } });
  gate.addEventListener("submit", async e => {
    e.preventDefault();
    const fd = new FormData(e.target), email = String(fd.get("email") || "").trim(), pw = String(fd.get("pw") || ""), pw2 = String(fd.get("pw2") || "");
    const btn = e.target.querySelector("button[type=submit]"), say = (m, k) => { const p = gate.querySelector(".nb-msg"); p.textContent = m; p.className = "nb-msg " + (k || ""); };
    if (mode !== "newpw" && !/^\S+@\S+\.\S+$/.test(email)) return say("Escribí un email válido.", "err");
    if ((mode === "in" || mode === "up" || mode === "newpw") && pw.length < 6) return say("La contraseña debe tener al menos 6 caracteres.", "err");
    if ((mode === "up" || mode === "newpw") && pw !== pw2) return say("Las contraseñas no coinciden.", "err");
    btn.disabled = true; say("Un momento…");
    try {
      if (mode === "in") {
        const { error } = await sb.auth.signInWithPassword({ email, password: pw });
        if (error) throw error;
      } else if (mode === "up") {
        const { data, error } = await sb.auth.signUp({ email, password: pw, options: { emailRedirectTo: location.origin } });
        if (error) throw error;
        if (!data.session) { mode = "in"; renderGate("Cuenta creada. Revisá tu email y tocá el enlace de confirmación; después ingresá acá.", "ok"); return; }
      } else if (mode === "reset") {
        const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
        if (error) throw error;
        mode = "in"; renderGate("Listo. Si el email tiene cuenta, te llega un enlace para cambiar la contraseña.", "ok"); return;
      } else if (mode === "newpw") {
        const { error } = await sb.auth.updateUser({ password: pw });
        if (error) throw error;
        gate.hidden = true; GD.toast("Contraseña actualizada.");
      }
    } catch (err) {
      const m = String(err && err.message || err);
      say(/Invalid login/i.test(m) ? "Email o contraseña incorrectos." : /not confirmed/i.test(m) ? "Todavía no confirmaste tu email. Revisá tu casilla (y la carpeta de spam)." :
        /already registered|already exists/i.test(m) ? "Ese email ya tiene cuenta. Ingresá o recuperá la contraseña." : /rate limit/i.test(m) ? "Demasiados intentos. Esperá unos minutos." : "No se pudo completar: " + m, "err");
    } finally { btn.disabled = false; }
  });

  /* ---------- barra de usuario ---------- */
  const chip = document.createElement("div");
  chip.className = "nb-user"; chip.hidden = true;
  const topr = $(".topr"); if (topr) topr.prepend(chip);
  function setStatus(kind, txt) {
    chip.innerHTML = `<span class="nb-mail" title="${esc(user && user.email)}">${esc(user && user.email)}</span><span class="nb-st ${kind}"><i></i>${esc(txt)}</span>
      <button class="btn sm" data-nb="save" title="Guardar ahora">Guardar</button><button class="btn sm" data-nb="out">Salir</button>`;
  }
  chip.addEventListener("click", e => { const b = e.target.closest("[data-nb]"); if (!b) return; if (b.dataset.nb === "save") save(true); else signOut(); });
  const hhmm = d => String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");

  /* ---------- datos ---------- */
  async function load() {
    loading = true; setStatus("saving", "Cargando…");
    const { data, error } = await sb.from(TABLA).select("datos,updated_at").eq("user_id", user.id).maybeSingle();
    if (error) { setStatus("err", "Error al cargar"); GD.toast("No se pudieron cargar tus datos: " + error.message); loading = false; return; }
    if (data && data.datos && Object.keys(data.datos).length) {
      try { GD.setState(data.datos); } catch (e) { console.error(e); GD.toast("Tus datos guardados no se pudieron aplicar del todo."); }
      lastSaved = new Date(data.updated_at); GD.toast("Tus datos se cargaron desde la nube.");
    } else {
      GD.toast("Cuenta nueva: arrancás con datos de ejemplo. Todo lo que cambies se guarda solo.");
    }
    lastJson = JSON.stringify(GD.getState());
    setStatus("", lastSaved ? "Guardado " + hhmm(lastSaved) : "Sin cambios");
    loading = false;
  }
  async function save(manual) {
    if (!user || loading || saving) return;
    let st, json;
    try { st = GD.getState(); json = JSON.stringify(st); } catch (e) { console.error(e); return; }
    if (json === lastJson && !manual) return;
    saving = true; setStatus("saving", "Guardando…");
    const { error } = await sb.from(TABLA).upsert({ user_id: user.id, datos: st, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    saving = false;
    if (error) { setStatus("err", "No se guardó"); if (manual) GD.toast("No se pudo guardar: " + error.message); return; }
    lastJson = json; lastSaved = new Date(); setStatus("", "Guardado " + hhmm(lastSaved));
    if (manual) GD.toast("Datos guardados en la nube.");
  }
  async function signOut() { await save(false); await sb.auth.signOut(); }

  function onUser(u) {
    const changed = (u && u.id) !== (user && user.id);
    user = u;
    clearInterval(timer);
    if (!user) { chip.hidden = true; mode = "in"; renderGate(); gate.hidden = false; lastJson = null; return; }
    gate.hidden = mode !== "newpw"; chip.hidden = false;
    if (changed) load();
    timer = setInterval(() => save(false), 15000);
  }

  /* ---------- arranque ---------- */
  async function start() {
    if (!window.GD) return setTimeout(start, 200);
    let cfg = null;
    try { const r = await fetch("/api/config", { cache: "no-store" }); if (r.ok) cfg = await r.json(); } catch (e) { cfg = null; }
    if (!cfg || !cfg.url || !cfg.key || !window.supabase) { console.warn("Nube no configurada: la página funciona sin cuentas."); return; }
    sb = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } });
    renderGate(); gate.hidden = false;
    sb.auth.onAuthStateChange((ev, session) => {
      if (ev === "PASSWORD_RECOVERY") { mode = "newpw"; renderGate(); gate.hidden = false; }
      setTimeout(() => onUser(session ? session.user : null), 0);
    });
    const { data } = await sb.auth.getSession();
    onUser(data.session ? data.session.user : null);
    addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") save(false); });
  }
  start();
})();
