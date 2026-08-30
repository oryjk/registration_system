import { Suspense } from "react";
import { Navigate, Outlet, useLocation } from "react-router";
import { AuthBootstrapError } from "@/components/AuthBootstrapError";
import { useAdminSession } from "@/features/admin-session/useAdminSession";
import { AdminShell } from "@/layout/AdminShell";
import { buildLoginUrl } from "@/utils/auth-redirect";

const HIDDEN_ROUTE_TITLES: { pattern: RegExp; title: string }[] = [
  { pattern: /^\/matches\/new$/, title: "发布比赛" },
  { pattern: /^\/matches\/[^/]+\/edit$/, title: "编辑比赛" },
  { pattern: /^\/matches\/[^/]+$/, title: "比赛详情" },
];

const PATH_TITLES: Record<string, string> = {
  "/": "系统概览",
  "/matches": "比赛管理",
  "/teams": "球队管理",
  "/match-admins": "比赛管理员",
  "/admins": "场馆管理员",
  "/access": "接入状态",
  "/mini-review": "审核版本",
  "/tips": "打赏与建议",
  "/system-settings": "系统设置",
};

export function resolveRouteTitle(pathname: string) {
  for (const { pattern, title } of HIDDEN_ROUTE_TITLES) {
    if (pattern.test(pathname)) return title;
  }
  return PATH_TITLES[pathname] ?? "开踢管理台";
}

export function AdminLayout() {
  const { currentAdmin, authBootstrapError, bootstrapping, refresh, logout } =
    useAdminSession();
  const location = useLocation();

  if (bootstrapping) {
    return (
      <div aria-label="加载中" className="workspace-loading" role="status" />
    );
  }

  if (authBootstrapError) {
    return (
      <AuthBootstrapError
        message={authBootstrapError}
        onRetry={() => void refresh()}
      />
    );
  }

  if (!currentAdmin) {
    return <Navigate replace to={buildLoginUrl(location)} />;
  }

  return (
    <AdminShell
      title={resolveRouteTitle(location.pathname)}
      username={currentAdmin.username}
      isSuperAdmin={Boolean(currentAdmin.is_super_admin)}
      currentPath={location.pathname}
      onLogout={logout}
    >
      <Suspense
        fallback={
          <div
            aria-label="加载中"
            className="workspace-loading"
            role="status"
          />
        }
      >
        <Outlet />
      </Suspense>
    </AdminShell>
  );
}
