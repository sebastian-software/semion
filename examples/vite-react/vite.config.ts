import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { semion } from "semion/vite";

export default defineConfig({
  plugins: [semion(), react()],
});
