
# Report & Run — App de reportes IT

App en español con modo claro/oscuro para documentar trabajos de campo (cableado, instalaciones, mantenimiento) con evidencia visual fechada.

## Autenticación
- Login con email + contraseña vía Lovable Cloud.
- Tabla `profiles` con nombre del técnico (auto-creada al registrarse).
- Rutas protegidas: solo usuarios autenticados acceden a proyectos.
- Cada técnico ve sus propios proyectos (RLS por `user_id`).

## Estructura

### 1. Dashboard `/`
- Lista de proyectos del técnico con nombre, ubicación, fecha de creación, miniatura de la última entrada y contador de entradas.
- Botón "Nuevo proyecto" → modal (nombre, cliente/ubicación, descripción opcional).
- Búsqueda por nombre y filtro por estado (activo/finalizado).

### 2. Vista de proyecto `/proyecto/$id`
Header con nombre del proyecto, ubicación, fecha y botón "Finalizar/Reabrir".

**Dos vistas alternables (toggle arriba a la derecha):**
- **Timeline (default)**: grid minimalista de tarjetas con miniatura grande, ícono de tipo (📷 foto / 🎥 video / 📝 nota), título corto y timestamp relativo ("hace 2h"). Agrupado visualmente por día con separador sticky ("Hoy", "Ayer", "12 abr 2026").
- **Lista**: tabla compacta cronológica — columnas: hora, tipo, título, descripción breve, miniatura pequeña.

**Botón flotante (+)** abre menú radial:
- 📷 Tomar foto (cámara en vivo)
- 🎥 Grabar video (cámara en vivo)
- 🖼️ Subir desde galería (imagen o video)
- 📝 Nota de texto

**Modal de captura** para cada entrada:
- Preview del archivo
- Campo "Título" (ej. "Patch panel piso 3")
- Campo "Descripción/notas" (textarea)
- Timestamp automático (editable si es necesario)
- Botón "Guardar"

### 3. Detalle de entrada `/proyecto/$id/entrada/$entradaId`
- Vista ampliada del medio (imagen full-screen / player de video / nota completa).
- Metadatos: fecha y hora exactas, autor, tamaño original vs. comprimido.
- Editar título/descripción, eliminar.

## Compresión agresiva (cliente, antes de subir)
- **Imágenes**: redimensionar a máx 1280px lado mayor, JPEG calidad 70% (vía canvas API). Típicamente reduce 5MB → ~200KB.
- **Videos**: re-encode con MediaRecorder API a 720p, bitrate ~1Mbps, formato webm. Para uploads desde galería que no se puedan re-encodear en navegador, comprimir resolución y mostrar advertencia de tamaño.
- **Captura desde cámara**: usar `getUserMedia` con constraints de baja resolución directamente (1280x720 fotos, 720p video).
- Mostrar tamaño original → tamaño final antes de subir.

## Backend (Lovable Cloud)
- **Tablas**: `profiles`, `projects` (user_id, nombre, ubicación, descripción, status, timestamps), `entries` (project_id, user_id, type, title, description, media_url, thumbnail_url, original_size, compressed_size, captured_at, created_at).
- **Roles separados**: tabla `user_roles` con enum `app_role` (siguiendo el patrón seguro) — preparado para futuro rol admin.
- **Storage buckets**: `project-media` (privado, RLS por dueño del proyecto). Thumbnails generadas en cliente al subir.
- **RLS estricto**: cada usuario solo ve/edita sus proyectos y entradas.

## Diseño
- **Modo claro y oscuro** con toggle persistente (localStorage).
- Estética minimalista, mucho espacio en blanco, tipografía clara (Inter).
- Paleta neutra con un acento (azul) para botones primarios.
- Cards con bordes suaves, sombras ligeras solo en modo claro.
- Mobile-first: la app debe funcionar perfectamente en celular (caso de uso principal en campo).
- Iconos Lucide, animaciones sutiles.

## Idioma
- Toda la UI en español (botones, etiquetas, mensajes de error, fechas con `date-fns/locale/es`).
