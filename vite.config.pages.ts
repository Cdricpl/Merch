import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolve } from "path";

// Numéro de version affiché dans le header (petit badge en haut à droite).
// Bump manuellement ici à chaque changement notable.
const APP_VERSION = "v1.0";

export default defineConfig({
  base: "/Merch/",
  plugins: [viteReact(), tailwindcss(), tsconfigPaths()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  build: {
    outDir: "dist-pages",
    rollupOptions: {
      input: resolve(__dirname, "index.spa.html"),
    },
  },
});
