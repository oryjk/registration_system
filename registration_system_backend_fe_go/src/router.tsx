import { lazy } from "react";
import { createBrowserRouter, Navigate, Outlet } from "react-router";
import {
  AdminSessionProvider,
  useAdminSession,
} from "@/features/admin-session/useAdminSession";
import { AdminLayout } from "@/layout/AdminLayout";
import ForbiddenPage from "@/pages/ForbiddenPage";
import LoginPage from "@/pages/LoginPage";
import NotFoundPage from "@/pages/NotFoundPage";

const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const MatchListPage = lazy(() => import("@/pages/MatchListPage"));
const MatchFormPage = lazy(() => import("@/pages/MatchFormPage"));
const MatchDetailPage = lazy(() => import("@/pages/MatchDetailPage"));
const TeamListPage = lazy(() => import("@/pages/TeamListPage"));
const MatchAdminsPage = lazy(() => import("@/pages/MatchAdminsPage"));
const AdminListPage = lazy(() => import("@/pages/AdminListPage"));
const AccessPage = lazy(() => import("@/pages/AccessPage"));
const MiniReviewPage = lazy(() => import("@/pages/MiniReviewPage"));
const TipListPage = lazy(() => import("@/pages/TipListPage"));
const SystemSettingsPage = lazy(() => import("@/pages/SystemSettingsPage"));

function RequireSuperAdmin() {
  const { currentAdmin } = useAdminSession();
  if (!currentAdmin?.is_super_admin) {
    return <ForbiddenPage />;
  }
  return <Outlet />;
}

export const router = createBrowserRouter(
  [
    {
      // 会话 Provider 需要 Router 上下文（内部使用 useNavigate/useLocation），
      // 因此挂在路由树根部，所有路由（含 /login）共享同一会话状态。
      element: (
        <AdminSessionProvider>
          <Outlet />
        </AdminSessionProvider>
      ),
      children: [
        { path: "/login", element: <LoginPage /> },
        { path: "/403", element: <ForbiddenPage /> },
        { path: "/404", element: <NotFoundPage /> },
        {
          element: <AdminLayout />,
          children: [
            { path: "/", element: <DashboardPage /> },
            { path: "/matches", element: <MatchListPage /> },
            { path: "/matches/new", element: <MatchFormPage /> },
            { path: "/matches/:id", element: <MatchDetailPage /> },
            { path: "/matches/:id/edit", element: <MatchFormPage /> },
            { path: "/teams", element: <TeamListPage /> },
            { path: "/match-admins", element: <MatchAdminsPage /> },
            {
              element: <RequireSuperAdmin />,
              children: [{ path: "/admins", element: <AdminListPage /> }],
            },
            { path: "/access", element: <AccessPage /> },
            { path: "/mini-review", element: <MiniReviewPage /> },
            { path: "/tips", element: <TipListPage /> },
            { path: "/system-settings", element: <SystemSettingsPage /> },
          ],
        },
        { path: "*", element: <Navigate replace to="/404" /> },
      ],
    },
  ],
  { basename: import.meta.env.ADMIN_ROUTE_BASE || "/" },
);
