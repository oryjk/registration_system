import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

export default defineConfig({
  base: process.env.VITE_PUBLIC_BASE || "/",
  plugins: [uni()],
});
