import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const ReactCompilerConfig = {};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), [["babel-plugin-react-compiler", ReactCompilerConfig]]],
});
