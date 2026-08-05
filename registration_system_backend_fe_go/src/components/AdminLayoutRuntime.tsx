import { LogoutOutlined } from "@ant-design/icons";
import { Button, Tooltip } from "antd";
import { type ReactNode, useEffect } from "react";
import { history, useModel, useQueryClient } from "umi";
import { clearAdminToken } from "../auth/token-storage";
import ForbiddenPage from "../pages/ForbiddenPage";
import { buildLoginUrl } from "../utils/auth-redirect";
import { AuthBootstrapError } from "./AuthBootstrapError";

interface AdminLayoutChildrenProps {
  children: ReactNode;
  isPublicRoute: (pathname: string) => boolean;
}

export function AdminLayoutChildren({
  children,
  isPublicRoute,
}: AdminLayoutChildrenProps) {
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
  }, [isPublicRoute, queryClient, setInitialState]);

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

export function AdminLayoutSessionActions() {
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

export function AdminLayoutForbidden() {
  return <ForbiddenPage />;
}
