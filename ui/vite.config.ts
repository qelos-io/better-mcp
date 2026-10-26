import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

// Relative base: the app is served under a secret per-process path prefix.
export default defineConfig({
  root: import.meta.dirname,
  base: "./",
  plugins: [preact()],
  build: { outDir: "../dist/ui", emptyOutDir: true },
  server: { proxy: {} },
});
