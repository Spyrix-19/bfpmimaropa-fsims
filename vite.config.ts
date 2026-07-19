import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

// Serverless-friendly Vite config. No proxy middleware, no Wrangler, no
// hardcoded server assumptions — this project deploys as a static SPA on
// Cloudflare Pages, Vercel, Netlify, or any static host. All API calls go
// directly to VITE_BFP_MIMAROPA_API_BASE_URL from the browser.
export default defineConfig({
  plugins: [react(), tsconfigPaths(), tailwindcss()],
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
