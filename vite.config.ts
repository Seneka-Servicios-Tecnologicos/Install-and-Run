// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
//
// We disable the Cloudflare plugin and target Vercel so the production build
// emits a Node/serverless output compatible with Vercel hosting.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  cloudflare: false,
  tanstackStart: { target: "vercel" },
});
