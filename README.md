# Sistema Integral de Gestión SSO

Aplicación web PWA para Técnicos Prevencionistas.

## Cómo usar

1. Abre la app desde un servidor local o desde Vercel. En este entorno quedó disponible en `http://127.0.0.1:4173/`.
2. Para instalar como PWA: En Chrome, ve a menú > Instalar [Nombre de la app].
3. Navega usando el menú lateral (hamburguesa en móvil).
4. En "Inspecciones": Crea una nueva inspección con checklist, fotos y firma digital.

## Sincronización con Supabase

1. Crea un proyecto en Supabase.
2. Copia y ejecuta el contenido de `supabase-schema.sql` en el SQL Editor de Supabase.
3. En la app, entra a "Configuración".
4. Pega la `Project URL` y la `anon public key`.
5. Pulsa "Guardar configuración" y luego "Sincronizar ahora".

Las inspecciones y documentos se siguen guardando localmente en IndexedDB. Cuando Supabase está configurado y hay conexión, se sincronizan con las tablas `sso_inspecciones` y `sso_documentos`.

## Funcionalidades implementadas

- Dashboard con selector de empresas y alertas.
- Planificación anual importada desde Excel, con vista semanal en Dashboard.
- Alta de actividades nuevas y cambio de estado.
- Descarga de documentos en su formato original.
- Seguimiento de accidentes.
- Sincronización opcional de inspecciones y documentos con Supabase.
- Módulo de inspecciones optimizado para móvil:
  - Checklist interactivo.
  - Captura de fotos con geolocalización.
  - Firma digital con canvas.
  - Almacenamiento offline con IndexedDB y sincronización cloud opcional.

## Próximos pasos

- Generación automática de PDFs.
- OCR para carga inteligente de datos.
- Autenticación de usuarios para políticas de Supabase más restringidas.
- Módulos de planificación y analíticas.

## Tecnologías

- HTML5, CSS3, JavaScript (Vanilla).
- PWA con Service Worker e IndexedDB.
- Supabase JS para sincronización cloud.
- APIs: Camera, Geolocation, Canvas.
