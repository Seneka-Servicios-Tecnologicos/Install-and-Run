## 1. Quitar vista "Lista" y renombrar Timeline → Galería

**Archivos:** `src/routes/proyecto.$id.tsx`, `src/routes/cliente.$id.tsx`

- Cambiar el tipo de estado `view` para que solo acepte `"galeria" | "cronologia"` (default `"galeria"`).
- Eliminar el `<TabsTrigger value="lista">` y todo el bloque de renderizado `view === "lista"` en ambas rutas.
- Renombrar el trigger "Timeline" a **"Galería"** (mantener el ícono `LayoutGrid` que es coherente con cuadrícula). Cambiar `value="timeline"` → `value="galeria"` y la condición de render correspondiente.
- En `cliente.$id.tsx`, que actualmente solo tiene Timeline/Lista, queda solo Galería (cuadrícula) — opcionalmente añadir Cronología ahí también para consistencia (lo dejo fuera salvo que lo pidas).

## 2. Crear nuevos usuarios — flujo correcto

Hoy `auth.tsx` permite que cualquiera se auto-registre con email + contraseña. Como ahora los proyectos son colaborativos entre usuarios autenticados, conviene un flujo controlado. Propongo:

### A. Restablecimiento de contraseña (faltante hoy)

- Añadir enlace **"¿Olvidaste tu contraseña?"** en `src/routes/auth.tsx` que llame:
  ```ts
  supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  })
  ```
- Crear nueva ruta pública `src/routes/reset-password.tsx` con formulario de nueva contraseña que llama `supabase.auth.updateUser({ password })`.

### B. Invitar usuarios desde la app (recomendado)

En `src/routes/usuarios.tsx` añadir botón **"Invitar usuario"** (visible para todos los autenticados, según pediste antes) que abre un diálogo con email + nombre. Al enviar:

1. Llama a una **edge function** nueva `invite-user` (deployada automáticamente).
2. La function usa `SUPABASE_SERVICE_ROLE_KEY` (ya existe como secret) para llamar `supabase.auth.admin.inviteUserByEmail(email, { data: { full_name } })`.
3. Supabase envía automáticamente el email de invitación; el usuario hace click, llega a `/reset-password` y define su contraseña inicial.
4. El trigger `handle_new_user` ya existente crea su `profile` y le asigna rol `tecnico` automáticamente.

### C. Emails branded (opcional, lo recomiendo)

Por defecto Supabase envía los emails de invitación, confirmación y reset con plantillas genéricas desde su dominio. Si quieres que los correos lleguen desde **tu dominio** con branding Seneka (logo, colores), hay que configurar un dominio de email en Lovable Cloud y luego scaffoldear las plantillas de auth. Esto requiere un dominio que controles (ej. `seneka.com`) y añadir registros DNS. **Te lo pregunto abajo** porque cambia el alcance.

### D. ¿Mantener auto-registro abierto?

Hoy cualquier persona con la URL puede crear cuenta. Como los proyectos son colaborativos, opciones:
- **Cerrado:** quitar el modo "signup" de `auth.tsx`, solo se entra por invitación.
- **Abierto:** dejarlo como está, además de permitir invitaciones.

Te lo pregunto abajo.

## Archivos a modificar/crear

- ✏️ `src/routes/proyecto.$id.tsx` — quitar Lista, renombrar a Galería
- ✏️ `src/routes/cliente.$id.tsx` — quitar Lista, renombrar a Galería
- ✏️ `src/routes/auth.tsx` — añadir "¿Olvidaste tu contraseña?"
- ➕ `src/routes/reset-password.tsx` — nueva ruta pública
- ✏️ `src/routes/usuarios.tsx` — botón "Invitar usuario" + diálogo
- ➕ `supabase/functions/invite-user/index.ts` — edge function con service role
- ✏️ `supabase/config.toml` — registro de la function

## Preguntas antes de implementar

1. ¿Cierro el auto-registro en `/auth` (solo por invitación) o lo dejo abierto?
2. ¿Quieres branding de email con tu dominio (Seneka) o usamos los emails por defecto de Supabase de momento?
3. En `cliente.$id.tsx` actualmente solo hay Timeline/Lista — ¿añado también la vista Cronología ahí, o la dejo solo con Galería?
