# Seneka — Report & Run

App de reportes IT en campo (TanStack Start v1 + React 19 + Supabase).

> ⚠️ **Importante sobre el hosting**
>
> Esta app usa **TanStack Start con SSR**. El framework está construido para **Cloudflare Workers/Pages** (es su target oficial actual). **No es compatible con Vercel out-of-the-box** — Vercel devolverá 404 porque no sabe cómo servir el bundle SSR de TanStack Start v1.
>
> Despliega en **Cloudflare Pages** (gratis, 1 click) o usa el botón **Publish** de Lovable.

---

## Opción A — Publicar desde Lovable (más fácil)

Click en **Publish** arriba a la derecha en el editor de Lovable. La app sale a `https://installandrun.lovable.app` (o tu dominio personalizado). Cero configuración.

## Opción B — Cloudflare Pages (auto-hosting)

1. Push a GitHub (ya conectado vía Lovable).
2. Ve a [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Selecciona el repo. Configura:
   - **Build command**: `bun install && bun run build`
   - **Build output directory**: `dist/client`
   - **Framework preset**: None
4. **Variables de entorno** (Settings → Environment Variables, en Production y Preview):

   | Variable | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://daakyngvtaidjtjvxutm.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | tu anon key (la del `.env` local) |
   | `VITE_SUPABASE_PROJECT_ID` | `daakyngvtaidjtjvxutm` |
   | `SUPABASE_URL` | igual que `VITE_SUPABASE_URL` |
   | `SUPABASE_PUBLISHABLE_KEY` | igual que `VITE_SUPABASE_PUBLISHABLE_KEY` |

5. Deploy. Cloudflare lo sirve con SSR.

> Alternativa: con la CLI `wrangler deploy` (usa `wrangler.jsonc` que ya está configurado).

## Opción C — Cualquier host con Node SSR

El bundle generado por `bun run build` produce:
- `dist/client/` → assets estáticos
- `dist/server/` → handler SSR (formato Workers/Web Standard)

Para Node tradicional necesitarías un wrapper que invoque `@tanstack/react-start/server-entry` desde un servidor Node (Express/Hono). No es complicado pero requiere unas 30 líneas de boilerplate. Pregunta y lo añado.

---

## Whitelist en Supabase Auth

Independientemente del host, en el dashboard de Supabase del proyecto:
- Authentication → URL Configuration → **Site URL**: tu dominio de producción
- **Redirect URLs**: añade `https://tu-dominio/**` y `https://tu-dominio/reset-password`

Esto es necesario para que las invitaciones y el reset de contraseña funcionen.

---

## Desarrollo local

```bash
bun install
cp .env.example .env   # rellena con tus valores
bun dev
```

App en http://localhost:8080.

## Stack

- TanStack Start v1 (SSR + file-based routing)
- React 19, Tailwind v4, shadcn/ui
- Supabase (Postgres + Auth + Storage + Edge Functions)
- Cloudflare Workers (target SSR)

## Backend

El schema, RLS y la edge function `invite-user` viven en el proyecto Supabase y son **completamente independientes del host frontend**. Cualquier deployment con las env vars correctas funciona contra el mismo backend.
