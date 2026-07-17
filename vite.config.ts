/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Relative base so a build can be dropped on GitHub Pages, a subfolder, or
  // opened straight off disk without a rewrite.
  base: "./",
  build: {
    outDir: "dist",
    sourcemap: true,
  },
  test: {
    globals: true,
    environment: "node",
    include: ["*.test.ts"],
  },
});
