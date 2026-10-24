import { fileURLToPath } from "node:url";
import path from "node:path";
import tailwindcss from "@tailwindcss/postcss";
import vinext from "vinext";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const appCssPath = path.resolve(fileURLToPath(new URL("./app/globals.css", import.meta.url)));

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "cloudflare:workers",
        replacement: fileURLToPath(new URL("./lib/node-env.ts", import.meta.url)),
      },
    ],
  },
  css: { postcss: { plugins: [tailwindcss()] } },
  plugins: [
    {
      name: "node-tailwind-import-resolution",
      enforce: "pre",
      transform(code, id) {
        if (path.resolve(id.split("?")[0]) !== appCssPath) return null;
        return code.replace("@import 'tailwindcss';", "@import '../node_modules/tailwindcss/index.css';");
      },
    },
    vinext(),
    nitro(),
  ],
});
