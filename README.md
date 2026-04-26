# Sistema Integral de Gestión SSO

Aplicación web PWA para Técnicos Prevencionistas.

## Cómo usar

1. Abre `index.html` en un navegador moderno (Chrome recomendado para PWA).
2. Para instalar como PWA: En Chrome, ve a menú > Instalar [Nombre de la app].
3. Navega usando el menú lateral (hamburguesa en móvil).
4. En "Inspecciones": Crea una nueva inspección con checklist, fotos y firma digital.

## Funcionalidades implementadas

- Dashboard con selector de empresas y alertas.
- Módulo de inspecciones optimizado para móvil:
  - Checklist interactivo.
  - Captura de fotos con geolocalización.
  - Firma digital con canvas.
  - Almacenamiento offline con IndexedDB.

## Próximos pasos

- Generación automática de PDFs.
- OCR para carga inteligente de datos.
- Sincronización con backend.
- Módulos de planificación y analíticas.

## Tecnologías

- HTML5, CSS3, JavaScript (Vanilla).
- PWA con Service Worker e IndexedDB.
- APIs: Camera, Geolocation, Canvas.