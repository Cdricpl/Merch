import { defineConfig } from "vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { resolve } from "path";

const buildId = new Intl.DateTimeFormat("fr-BE", {
  timeZone: "Europe/Brussels",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
}).format(new Date());

export default defineConfig({
  base: "/Merch/",
  plugins: [viteReact(), tailwindcss(), tsconfigPaths()],
  define: {
    __APP_VERSION__: JSON.stringify(buildId),
  },
  build: {
    outDir: "dist-pages",
    rollupOptions: {
      input: resolve(__dirname, "index.spa.html"),
    },
  },
});
