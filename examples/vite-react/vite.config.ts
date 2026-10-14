import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { semion } from "semion/vite";

export default defineConfig({
  base: "/semion/",
  plugins: [semion(), react()],
});
