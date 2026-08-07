import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolve } from "path";

// Numéro de version affiché dans le header (petit badge en haut à droite).
// Bump manuellement ici à chaque changement notable.
const APP_VERSION = "v2.4";

export default defineConfig({
  base: "/Merch/",
  plugins: [viteReact(), tailwindcss(), tsconfigPaths()],
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  build: {
    outDir: "dist-pages",
    // Firebase pèse l'essentiel du bundle et ne bouge quasiment jamais : dans
    // son propre chunk, il reste en cache navigateur d'un déploiement à l'autre
    // au lieu d'être retéléchargé à chaque correction de l'app.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      input: resolve(__dirname, "index.spa.html"),
      output: {
        manualChunks: (id) =>
          id.includes("node_modules/firebase") || id.includes("node_modules/@firebase")
            ? "firebase"
            : undefined,
      },
    },
  },
});
