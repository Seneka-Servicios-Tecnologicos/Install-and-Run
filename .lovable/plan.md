# Hacer la app independiente de Lovable y desplegable en Vercel

## Diagnóstico

El 404 en Vercel viene de tres causas combinadas:

1. **Build target equivocado.** El proyecto está configurado para **Cloudflare Workers** (`wrangler.jsonc` + `@cloudflare/vite-plugin` activado por `@lovable.dev/vite-tanstack-config`). El output de ese build no es compatible con Vercel — Vercel sirve `dist/` como estático y no encuentra `index.html` para rutas como `/clientes`, de ahí el 404.
2. **Variables de entorno ausentes en Vercel.** El `.env` está en `.gitignore`, así que `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` no llegan al build de Vercel. Aunque arreglemos el routing, Supabase no inicializa.
3. **Sin preset Node para TanStack Start.** Para SSR en Vercel hay que decirle a TanStack Start que genere salida tipo Node/Vercel, no Worker.

## Cambios a realizar

### 1. Cambiar el target de build a Vercel (Node SSR)
- En `vite.config.ts`, pasar opciones al wrapper de Lovable:
  - `cloudflare: false` para desactivar el plugin de Cloudflare en build.
  - `tanstackStart: { target: "vercel" }` para que TanStack Start emita el handler serverless que Vercel espera (`.vercel/output/`).
- Eliminar `wrangler.jsonc` (ya no aplica) y la dependencia `@cloudflare/vite-plugin` del `package.json` (queda inerte).

### 2. Configurar variables de entorno en Vercel
- Documentar (en un `README.md` actualizado) qué variables hay que añadir en el dashboard de Vercel → Settings → Environment Variables:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_SUPABASE_PROJECT_ID`
  - `SUPABASE_URL`
  - `SUPABASE_PUBLISHABLE_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (solo si en algún momento usamos server functions admin; hoy no es estrictamente necesario porque `invite-user` vive en Supabase Edge).
- Añadir un `.env.example` con las claves (sin valores secretos) para que cualquiera pueda clonar y desplegar.
- Mantener `.env` en `.gitignore` (correcto). Las claves anon son públicas pero igual se gestionan vía Vercel.

### 3. Añadir `vercel.json` mínimo
- Configurar `framework: null` y dejar que el preset de TanStack Start maneje el output. Solo hace falta si Vercel no autodetecta — en la mayoría de casos no es necesario, pero lo incluimos como fallback con `buildCommand: "vite build"` y `outputDirectory: ".vercel/output"`.

### 4. Verificar Supabase y RLS independientes de Lovable
- El cliente Supabase ya lee de `import.meta.env.VITE_SUPABASE_URL` con fallback a `process.env.SUPABASE_URL` — compatible con cualquier host. ✔
- Las RLS policies y la función Edge `invite-user` viven dentro del proyecto Supabase administrado, no en Lovable. Siguen funcionando desde cualquier dominio. ✔
- La función `invite-user` usa `redirectTo: ${origin}/reset-password`. Hay que asegurarse de que el dominio de Vercel esté en **Supabase → Authentication → URL Configuration → Redirect URLs**. Lo dejaré documentado en el README.

### 5. Limpieza del repositorio para auto-hospedaje
- README con pasos: clonar, `bun install`, configurar env vars, `vercel deploy`.
- Quitar `.lovable/` del control de versiones si está committeado (añadir a `.gitignore`).
- Quitar `wrangler.jsonc`.

## Detalles técnicos (resumen)

```text
vite.config.ts
└─ defineConfig({
     cloudflare: false,
     tanstackStart: { target: "vercel" },
   })

Vercel env vars (Production + Preview):
  VITE_SUPABASE_URL=...
  VITE_SUPABASE_PUBLISHABLE_KEY=...
  VITE_SUPABASE_PROJECT_ID=daakyngvtaidjtjvxutm
  SUPABASE_URL=...
  SUPABASE_PUBLISHABLE_KEY=...

Supabase Auth → Redirect URLs:
  https://<tu-dominio-vercel>.vercel.app/reset-password
  https://<tu-dominio-vercel>.vercel.app/**
```

## Lo que NO hace falta cambiar
- Código de rutas, componentes, hooks, Supabase client → ya son agnósticos al host.
- Schema de base de datos y RLS → independiente de Lovable, vive en el proyecto Supabase.
- Edge function `invite-user` → se mantiene en Supabase, accesible desde cualquier dominio.

## Resultado esperado
Tras estos cambios, `git push` a GitHub e import en Vercel → build exitoso → SSR funcionando en `/`, `/clientes`, `/proyecto/$id`, etc., sin 404, con la misma base de datos y auth que en Lovable.
