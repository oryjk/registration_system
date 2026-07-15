import { defineConfig } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

export default defineConfig({
  plugins: [uni()],
  server: {
    proxy: {
      "/go-api": {
        target: "http://127.0.0.1:18080",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/go-api/, ""),
      },
    },
  },
});
