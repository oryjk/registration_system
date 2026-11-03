import { defineConfig, loadEnv } from "vite";
import uni from "@dcloudio/vite-plugin-uni";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const isMiniDevelopment = mode === "development" && process.env.UNI_PLATFORM === "mp-weixin";
  return {
    base: env.VITE_PUBLIC_BASE || "/",
    define: isMiniDevelopment ? {
      "import.meta.env.VITE_API_BASE_URL": JSON.stringify(
        env.VITE_MP_DEV_API_BASE_URL?.trim() || "http://172.16.60.233:18081/api/v1/app",
      ),
      "import.meta.env.VITE_CHANLUN_H5_URL": JSON.stringify(
        env.VITE_MP_DEV_CHANLUN_H5_URL?.trim() || "http://172.16.60.233:5173/",
      ),
    } : {},
    plugins: [uni()],
  };
});
