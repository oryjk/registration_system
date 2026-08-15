import { defineConfig } from "@umijs/max";
import defaultSettings from "./defaultSettings";
import proxy from "./proxy";
import routes from "./routes";

const { UMI_ENV = "dev" } = process.env;

function routePrefix(value: string | undefined) {
  const normalized = value?.trim() || "/";
  return normalized === "/"
    ? normalized
    : `/${normalized.replace(/^\/+|\/+$/g, "")}/`;
}

const publicPath = routePrefix(process.env.ADMIN_PUBLIC_PATH);
const base = routePrefix(process.env.ADMIN_ROUTE_BASE);

export default defineConfig({
  access: {},
  antd: {
    configProvider: {
      variant: "filled",
      theme: {
        cssVar: true,
        components: {
          Layout: {
            bodyBg: "#f3f6f4",
            headerBg: "#ffffff",
            headerHeight: 64,
            siderBg: "#18211c",
          },
        },
        token: {
          borderRadius: 6,
          colorInfo: "#28704b",
          colorPrimary: "#28704b",
          fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
        },
      },
    },
  },
  base,
  fastRefresh: true,
  hash: true,
  history: { type: "browser" },
  initialState: {},
  layout: {
    locale: false,
    ...defaultSettings,
  },
  manifest: {},
  model: {},
  proxy: proxy[UMI_ENV as keyof typeof proxy],
  publicPath,
  reactQuery: {},
  routePrefetch: {
    defaultPrefetch: "none",
  },
  routes,
  title: "开踢管理台",
  // @utoo/pack 1.4.3 的持久化缓存（turbo-tasks SST）在热更新时会损坏并直接导致
  // dev server panic 退出，开发环境关闭持久化缓存规避该问题。
  utoopack: {
    persistentCaching: false,
  },
  define: {
    "process.env.ADMIN_API_BASE_URL":
      process.env.ADMIN_API_BASE_URL?.trim() || "",
    "process.env.ADMIN_ROUTE_BASE": base,
  },
});
