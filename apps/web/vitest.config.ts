import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@pharmacy-os/types": fileURLToPath(new URL("../../packages/types/src/index.ts", import.meta.url)),
      "@pharmacy-os/ui": fileURLToPath(new URL("../../packages/ui/src/index.ts", import.meta.url)),
      "@pharmacy-os/utils": fileURLToPath(new URL("../../packages/utils/src/index.ts", import.meta.url))
    }
  },
  test: {
    environment: "jsdom",
    exclude: ["e2e/**", "src/tests/e2e/**", "node_modules/**", "dist/**"],
    globals: true,
    setupFiles: ["./src/tests/setup.ts"]
  }
});
