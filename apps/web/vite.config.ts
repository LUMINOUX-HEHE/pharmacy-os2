import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg"],
      manifest: {
        name: "Pharmacy OS",
        short_name: "Pharmacy OS",
        theme_color: "#00D4AA",
        background_color: "#0A1628",
        display: "standalone",
        icons: [
          {
            src: "/favicon.svg",
            sizes: "192x192",
            type: "image/svg+xml"
          }
        ]
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/v1/inventory") || url.pathname.startsWith("/api/v1/customers"),
            handler: "NetworkFirst",
            options: {
              cacheName: "pharmacy-os-catalogue",
              expiration: { maxEntries: 120, maxAgeSeconds: 24 * 60 * 60 }
            }
          }
        ]
      }
    })
  ],
  resolve: {
    alias: {
      "@pharmacy-os/types": fileURLToPath(new URL("../../packages/types/src/index.ts", import.meta.url)),
      "@pharmacy-os/ui": fileURLToPath(new URL("../../packages/ui/src/index.ts", import.meta.url)),
      "@pharmacy-os/utils": fileURLToPath(new URL("../../packages/utils/src/index.ts", import.meta.url))
    }
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:4000"
    }
  }
});
