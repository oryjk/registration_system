import { defineConfig, loadEnv } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const miniDevApiBase = mode === "development" && process.env.UNI_PLATFORM === "mp-weixin"
    ? env.VITE_MP_DEV_API_BASE_URL?.trim() || "http://172.16.60.233:18081/api/v1/app"
    : undefined;
  return {
    base: env.VITE_PUBLIC_BASE || "/",
    define: miniDevApiBase ? {
      "import.meta.env.VITE_API_BASE_URL": JSON.stringify(miniDevApiBase),
    } : {},
    plugins: [uni()],
  };
});
