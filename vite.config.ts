// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    optimizeDeps: {
      ignoreOutdatedRequests: true,
      exclude: ["@tanstack/react-start"],
      include: [
        "@radix-ui/react-dialog",
        "@radix-ui/react-label",
        "@radix-ui/react-slot",
        "@supabase/supabase-js",
        "@tanstack/react-router",
        "class-variance-authority",
        "clsx",
        "lucide-react",
        "react",
        "react-dom/client",
        "react/jsx-runtime",
        "tailwind-merge",
      ],
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
