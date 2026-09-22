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
// Content-Security-Policy. The authoritative copy is served as a real HTTP
// response header from public/_headers (Cloudflare Pages / Netlify). This meta
// tag is a fallback for hosts that ignore _headers, and is injected into the
// production build only — the dev server needs inline scripts for HMR.
const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  "script-src 'self'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://bfpr4bv3-api.onrender.com https://bfpr4bv3-api.up.railway.app https://api.ipify.org",
  "manifest-src 'self'",
  "media-src 'self' blob:",
].join("; ");

const cspMeta = {
  name: "csp-meta-fallback",
  apply: "build" as const,
  transformIndexHtml(html: string) {
    return html.replace(
      "<head>",
      `<head>\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
    );
  },
};

export default defineConfig({
  plugins: [
    cspMeta,
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
        // /offline.html is precached and served directly — never swapped for the SPA shell.
        navigateFallbackDenylist: [/^\/~oauth/, /^\/api\//, /^\/offline\.html$/],
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
            // Read-only reference lookups (stations, locations, offices and
            // gentable code lists). Cached so forms still open and their
            // dropdowns still fill in when a field inspector has no signal.
            // Network is always tried first, so online users never see stale
            // lists. Record data, authentication and every write stay
            // uncached — nothing that carries a session token is stored.
            urlPattern: ({ url, request }) =>
              request.method === "GET" &&
              /\/api\/v1\/(Station\/Search|Location\/Search|Office\/Search|Gentable\/(Code|Search))$/i.test(
                url.pathname,
              ),
            handler: "NetworkFirst",
            options: {
              cacheName: "fsims-reference-data",
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 },
              cacheableResponse: { statuses: [200] },
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
