import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

// Serverless-friendly Vite config. No proxy middleware, no Wrangler, no
// hardcoded server assumptions — this project deploys as a static SPA on
// Cloudflare Pages, Vercel, Netlify, or any static host. All API calls go
// directly to VITE_BFP_MIMAROPA_API_BASE_URL from the browser.
export default defineConfig({
  plugins: [
    react(),
    tsconfigPaths(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      // The app registers the worker itself through src/lib/pwa.ts so that
      // dev/preview contexts stay service-worker free.
      injectRegister: null,
      devOptions: { enabled: false },
      filename: "sw.js",
      // The manifest already exists in public/ and stays the single source.
      manifest: false,
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff,woff2}"],
        // Heavy, lazily-loaded vendor chunks are cached on first use at
        // runtime instead of bloating the install-time precache.
        globIgnores: ["**/exceljs*.js"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        // Prompt-based updates: the new worker must not claim open tabs
        // before the user accepts, otherwise assets and HTML can mismatch.
        clientsClaim: false,
        skipWaiting: false,
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//],
        runtimeCaching: [
          {
            // HTML navigations always try the network first so a new
            // deployment is picked up instead of a stale shell.
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "NetworkFirst",
            options: {
              cacheName: "fsims-html",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // Same-origin hashed build assets, images and fonts only.
            urlPattern: ({ url, request, sameOrigin }) =>
              sameOrigin &&
              !url.pathname.startsWith("/api/") &&
              ["style", "script", "worker", "image", "font"].includes(request.destination),
            handler: "CacheFirst",
            options: {
              cacheName: "fsims-assets",
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "::",
    port: 8080,
    strictPort: true,
  },
});
