# Gemelo Digital CD

Gemelo digital 3D de un centro de distribución: simulación por turnos, KPIs por cliente, predicción, optimización, escenarios y simulación de ahorro.

Página publicada: https://gemelo-digital-cd.vercel.app

## Cómo funciona
- index.html: la aplicación completa (Three.js, carga de Excel con SheetJS).
- nube.js: cuentas de usuario (registro, ingreso, recuperar contraseña) y guardado automático en Supabase.
- api/config.js: entrega al navegador la URL y la clave pública de Supabase desde las variables de entorno de Vercel.

## Datos
Cada usuario guarda su configuración, escenarios, simulación de ahorro, inventario y pedidos en la tabla gemelo_estado de Supabase. Las políticas de seguridad (RLS) hacen que cada uno solo vea y edite sus propios datos.
