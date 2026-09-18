import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  base: process.env.PAGES_BASE_PATH || "/",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        home: path.join(root, "index.html"),
        tools: path.join(root, "tools/index.html"),
      },
    },
  },
});
