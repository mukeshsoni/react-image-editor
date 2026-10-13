import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

import { imageFile, imageSizes } from "./support/images";
import type { ImageName } from "./support/images";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const consumer = process.env.E2E_REACT_VERSION;
const root = consumer ? path.join(repo, ".e2e-consumers", `react-${consumer}`) : path.join(repo, "e2e/host");

export default defineConfig({
  root,
  plugins: [
    react({ babel: { plugins: [["babel-plugin-react-compiler", { target: "18" }]] } }),
    tailwindcss(),
    {
      name: "deterministic-e2e-images",
      configureServer(server) {
        server.middlewares.use((request, response, next) => {
          const url = new URL(request.url ?? "/", "http://localhost");
          if (!url.pathname.startsWith("/__e2e_images__/")) return next();
          const filename = url.pathname.split("/").at(-1) ?? "";
          const [name, extension] = filename.split(".");
          if (!Object.hasOwn(imageSizes, name)) {
            response.statusCode = 404; response.end("Unknown test image"); return;
          }
          if (url.searchParams.has("no-cors")) response.removeHeader("Access-Control-Allow-Origin");
          else response.setHeader("Access-Control-Allow-Origin", "*");
          const format = extension === "jpeg" ? "jpeg" : "png";
          response.setHeader("Content-Type", `image/${format}`);
          response.setHeader("Cache-Control", "no-store");
          response.end(imageFile(name as ImageName, format));
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.join(repo, "src"),
      "editor-under-test": consumer
        ? path.join(root, "node_modules/@mukeshsoni/react-image-editor/dist/index.js")
        : path.join(repo, "src/index.ts"),
      "test-host-styles": path.join(root, "styles.css"),
      ...(consumer ? {
        react: path.join(root, "node_modules/react"),
        "react-dom": path.join(root, "node_modules/react-dom"),
      } : {}),
    },
    dedupe: ["react", "react-dom"],
  },
  server: { host: "127.0.0.1", fs: { allow: [repo] } },
});
