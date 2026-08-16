import type { ConfigProviderProps } from "antd";
import zhCN from "antd/locale/zh_CN";
import { lazy, type ReactNode, Suspense } from "react";
import { history } from "umi";
import { getCurrentAdmin } from "./api/auth";
import { ApiError } from "./api/client";
import { expireAdminSession } from "./auth/session-expiry";
import { getAdminToken } from "./auth/token-storage";
import { BrandMark } from "./components/BrandMark";
import type { RuntimeInitialState } from "./types/runtime";
import { buildLoginUrl, sanitizeRedirect } from "./utils/auth-redirect";

const AdminLayoutChildren = lazy(() =>
  import("./components/AdminLayoutRuntime").then((module) => ({
    default: module.AdminLayoutChildren,
  })),
);
const AdminLayoutSessionActions = lazy(() =>
  import("./components/AdminLayoutRuntime").then((module) => ({
    default: module.AdminLayoutSessionActions,
  })),
);
const AdminLayoutForbidden = lazy(() =>
  import("./components/AdminLayoutRuntime").then((module) => ({
    default: module.AdminLayoutForbidden,
  })),
);

async function fetchCurrentAdmin() {
  if (!getAdminToken()) return null;
  return getCurrentAdmin();
}

export function antd(config: ConfigProviderProps): ConfigProviderProps {
  return { ...config, locale: zhCN };
}

export async function getInitialState(): Promise<RuntimeInitialState> {
  try {
    return {
      currentAdmin: await fetchCurrentAdmin(),
      authBootstrapError: null,
      fetchCurrentAdmin,
    };
  } catch (reason) {
    if (reason instanceof ApiError && reason.status === 401) {
      expireAdminSession();
      return {
        currentAdmin: null,
        authBootstrapError: null,
        fetchCurrentAdmin,
      };
    }

    return {
      currentAdmin: null,
      authBootstrapError:
        reason instanceof Error ? reason.message : "管理员信息加载失败",
      fetchCurrentAdmin,
    };
  }
}

export function rootContainer(container: ReactNode): ReactNode {
  return container;
}

function isPublicRoute(pathname: string) {
  const route = sanitizeRedirect(pathname);
  return route === "/login" || route === "/403" || route === "/404";
}

export function layout({
  initialState,
}: {
  initialState?: RuntimeInitialState;
}) {
  return {
    childrenRender: (children: ReactNode) => (
      <Suspense fallback={null}>
        <AdminLayoutChildren isPublicRoute={isPublicRoute}>
          {children}
        </AdminLayoutChildren>
      </Suspense>
    ),
    footerRender: false,
    logo: <BrandMark />,
    menuDataRender: (menuData: { path?: string }[]) =>
      menuData.filter(
        (item) =>
          item.path !== "/admins" || initialState?.currentAdmin?.is_super_admin,
      ),
    menuHeaderRender: () => (
      <div className="brand-lockup">
        <BrandMark />
        <div className="brand-copy">
          <strong>开踢管理台</strong>
          <span>GO CONSOLE</span>
        </div>
      </div>
    ),
    menuItemRender: (
      item: { path?: string; isMobile?: boolean; onClick: () => void },
      defaultDom: ReactNode,
    ) => (
      <a
        href={item.path}
        onClick={(event) => {
          event.preventDefault();
          // ProLayout 的 item.onClick 语义是 onCollapse(true)，仅用于移动端抽屉关闭；
          // 桌面端调用会把侧边栏折叠，因此只在 isMobile 时调用。
          if (item.isMobile) item.onClick();
          if (item.path) history.push(item.path);
        }}
      >
        {defaultDom}
      </a>
    ),
    onPageChange: () => {
      if (
        !initialState?.currentAdmin &&
        !initialState?.authBootstrapError &&
        !isPublicRoute(history.location.pathname)
      ) {
        history.push(buildLoginUrl(history.location));
      }
    },
    rightContentRender: () => (
      <Suspense fallback={null}>
        <AdminLayoutSessionActions />
      </Suspense>
    ),
    unAccessible: (
      <Suspense fallback={null}>
        <AdminLayoutForbidden />
      </Suspense>
    ),
  };
}
