import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");

  return {
    plugins: [react()],
    server: {
      proxy: {
        "/go-api": {
          target: env.VITE_API_PROXY_TARGET || "http://127.0.0.1:18080",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/go-api/, ""),
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks: {
            "react-vendor": ["react", "react-dom", "react-router-dom"],
          },
        },
      },
    },
  };
});
