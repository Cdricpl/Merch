import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolve } from "path";

export default defineConfig({
  plugins: [viteReact(), tailwindcss(), tsconfigPaths()],
  build: {
    rollupOptions: {
      input: resolve(__dirname, "index.spa.html"),
    },
  },
});
