# Seneka — Report & Run

App de reportes IT en campo (TanStack Start + React 19 + Supabase).

## Desplegar en Vercel

1. **Importa el repo** en [vercel.com/new](https://vercel.com/new). Vercel detecta Vite automáticamente.
2. **Configura las variables de entorno** (Settings → Environment Variables, en Production + Preview):

   | Variable | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://daakyngvtaidjtjvxutm.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | tu anon key (la misma que está en `.env` local) |
   | `VITE_SUPABASE_PROJECT_ID` | `daakyngvtaidjtjvxutm` |
   | `SUPABASE_URL` | igual que `VITE_SUPABASE_URL` |
   | `SUPABASE_PUBLISHABLE_KEY` | igual que `VITE_SUPABASE_PUBLISHABLE_KEY` |

3. **Whitelist del dominio en Supabase Auth.** En el dashboard de Supabase del proyecto:
   - Authentication → URL Configuration → **Site URL**: `https://tu-app.vercel.app`
   - **Redirect URLs**: añade `https://tu-app.vercel.app/**` y `https://tu-app.vercel.app/reset-password`
   - Esto es necesario para que las invitaciones y el reset de contraseña redirijan correctamente.

4. **Deploy.** Vercel ejecuta `vite build` y publica el output SSR (`.vercel/output`). Las rutas `/clientes`, `/proyecto/$id`, etc. funcionan con SSR sin 404.

## Desarrollo local

```bash
bun install
cp .env.example .env   # rellena con tus valores
bun dev
```

App en http://localhost:8080.

## Stack

- **Framework**: TanStack Start v1 (SSR + file-based routing)
- **UI**: React 19, Tailwind v4, shadcn/ui
- **Backend**: Supabase (Postgres + Auth + Storage + Edge Functions)
- **Hosting**: Vercel (Node SSR). Build target configurable en `vite.config.ts`.

## Backend (Supabase)

El schema, RLS policies y la edge function `invite-user` viven en el proyecto Supabase y son independientes del frontend. Cualquier despliegue (Vercel, Netlify, self-hosted) que tenga las env vars correctas funciona contra el mismo backend.

### Edge function `invite-user`
Despliegue manual con Supabase CLI si la modificas:
```bash
supabase functions deploy invite-user --project-ref daakyngvtaidjtjvxutm
```
