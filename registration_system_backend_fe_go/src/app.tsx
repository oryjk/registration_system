import LogoutOutlined from "@ant-design/icons/es/icons/LogoutOutlined";
import Button from "antd/es/button";
import Tooltip from "antd/es/tooltip";
import { type ReactNode, useEffect } from "react";
import { history, useModel, useQueryClient } from "umi";
import { getCurrentAdmin } from "./api/auth";
import { ApiError } from "./api/client";
import { expireAdminSession } from "./auth/session-expiry";
import { clearAdminToken, getAdminToken } from "./auth/token-storage";
import { AuthBootstrapError } from "./components/AuthBootstrapError";
import { BrandMark } from "./components/BrandMark";
import ForbiddenPage from "./pages/ForbiddenPage";
import type { RuntimeInitialState } from "./types/runtime";
import { buildLoginUrl, sanitizeRedirect } from "./utils/auth-redirect";

async function fetchCurrentAdmin() {
  if (!getAdminToken()) return null;
  return getCurrentAdmin();
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

function AuthSessionBridge({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { initialState, refresh, setInitialState } = useModel("@@initialState");

  useEffect(() => {
    const handleSessionExpired = () => {
      queryClient.clear();
      void setInitialState((current) =>
        current
          ? { ...current, authBootstrapError: null, currentAdmin: null }
          : current,
      );

      if (!isPublicRoute(history.location.pathname)) {
        history.push(buildLoginUrl(history.location));
      }
    };

    window.addEventListener("admin-auth-expired", handleSessionExpired);
    return () => {
      window.removeEventListener("admin-auth-expired", handleSessionExpired);
    };
  }, [queryClient, setInitialState]);

  if (initialState?.authBootstrapError) {
    return (
      <AuthBootstrapError
        message={initialState.authBootstrapError}
        onRetry={() => void refresh()}
      />
    );
  }

  return children;
}

function SessionActions() {
  const queryClient = useQueryClient();
  const { initialState, setInitialState } = useModel("@@initialState");

  const logout = () => {
    clearAdminToken();
    queryClient.clear();
    void setInitialState((current) =>
      current
        ? { ...current, authBootstrapError: null, currentAdmin: null }
        : current,
    );
    history.push("/login");
  };

  return (
    <div className="layout-session-actions">
      <span className="layout-current-admin">
        {initialState?.currentAdmin?.username}
      </span>
      <Tooltip title="退出登录">
        <Button
          type="text"
          shape="circle"
          icon={<LogoutOutlined />}
          aria-label="退出登录"
          onClick={logout}
        />
      </Tooltip>
    </div>
  );
}

export function layout({
  initialState,
}: {
  initialState?: RuntimeInitialState;
}) {
  return {
    childrenRender: (children: ReactNode) => (
      <AuthSessionBridge>{children}</AuthSessionBridge>
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
      item: { path?: string; onClick: () => void },
      defaultDom: ReactNode,
    ) => (
      <a
        href={item.path}
        onClick={(event) => {
          event.preventDefault();
          item.onClick();
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
    rightContentRender: () => <SessionActions />,
    unAccessible: <ForbiddenPage />,
  };
}
