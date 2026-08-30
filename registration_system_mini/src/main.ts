import { createSSRApp } from "vue";
import App from "./App.vue";
import { initH5TencentMapConfig } from "./config/h5Map";
import { ingestWebViewAuthFromUrl } from "./utils/webview";

initH5TencentMapConfig();
// H5 启动早期接收小程序 web-view 桥接过来的登录态（非 H5 环境为空操作）。
ingestWebViewAuthFromUrl();

export function createApp() {
  const app = createSSRApp(App);
  return { app };
}
