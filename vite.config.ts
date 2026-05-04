// @lovable.dev/vite-tanstack-config already includes:
//   tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//   componentTagger (dev-only), VITE_* env injection, @ path alias, etc.
// The default build target is Cloudflare Workers/Pages, which is what we deploy to.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig();
