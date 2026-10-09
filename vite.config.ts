import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "KSP Letter Scan",
        short_name: "KSP Scan",
        description: "Capture, clean, and upload letters for OCR.",
        theme_color: "#111111",
        background_color: "#f5f1e8",
        display: "standalone",
        start_url: "/",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any"
          }
        ]
      },
      workbox: {
        globIgnores: ["**/vendor/**"]
      }
    })
  ]
});
