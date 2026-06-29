import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";

// Frontend (web UI) build. The Tauri shell loads this; it also runs standalone in
// a plain browser for development/testing without Rust.
export default defineConfig({
  plugins: [svelte()],
  // Serve the bundled example .vmm files at the web root (e.g. /rich.vmm) so the
  // "examples" buttons can fetch them in dev and in the built app.
  publicDir: "examples",
  // Use a fixed dev port so the Tauri config can point at it.
  server: { port: 5183, strictPort: true },
  build: {
    outDir: "dist-app",
    emptyOutDir: true,
    target: "es2022",
  },
});
