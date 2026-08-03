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
  antd: {
    appConfig: {},
    configProvider: {
      variant: "filled",
      theme: {
        cssVar: true,
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
  layout: {
    locale: false,
    ...defaultSettings,
  },
  locale: {
    antd: true,
    baseNavigator: false,
    default: "zh-CN",
  },
  manifest: {},
  proxy: proxy[UMI_ENV as keyof typeof proxy],
  publicPath,
  routePrefetch: {},
  routes,
  title: "开踢管理台",
  utoopack: {},
});
