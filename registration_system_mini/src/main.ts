import { createSSRApp } from "vue";
import App from "./App.vue";
import { initH5TencentMapConfig } from "./config/h5Map";

initH5TencentMapConfig();

export function createApp() {
  const app = createSSRApp(App);
  return { app };
}
