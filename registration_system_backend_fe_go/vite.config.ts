/// <reference types="vitest/config" />
import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

function routePrefix(value: string | undefined) {
  const normalized = value?.trim() || "/";
  return normalized === "/"
    ? normalized
    : `/${normalized.replace(/^\/+|\/+$/g, "")}/`;
}

const base = routePrefix(process.env.ADMIN_PUBLIC_PATH);
const apiProxyTarget = process.env.API_PROXY_TARGET || "http://127.0.0.1:18080";

export default defineConfig({
  base,
  // 允许 ADMIN_ 前缀环境变量进入 import.meta.env（API base 与路由 base 注入）
  envPrefix: ["ADMIN_"],
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: Number(process.env.PORT || 8000),
    proxy: {
      "/go-api": {
        target: apiProxyTarget,
        changeOrigin: true,
        rewrite: (proxyPath) => proxyPath.replace(/^\/go-api/, ""),
      },
    },
  },
  build: {
    manifest: true,
  },
  test: {
    environment: "jsdom",
    // jsdom 默认 about:blank 是 opaque origin，localStorage 不可用，需指定同源 url
    environmentOptions: {
      jsdom: {
        url: "http://localhost:8000/",
      },
    },
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/test/setup.ts"],
  },
});
