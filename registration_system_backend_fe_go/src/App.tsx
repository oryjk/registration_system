import ConfigProvider from "antd/es/config-provider";
import zhCN from "antd/locale/zh_CN";
import Result from "antd/es/result";
import theme from "antd/es/theme";
import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { ProtectedLayout } from "./auth/ProtectedLayout";

const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const AccessPage = lazy(() => import("./pages/AccessPage"));
const LoginPage = lazy(() => import("./pages/LoginPage"));
const MatchListPage = lazy(() => import("./pages/MatchListPage"));
const MatchDetailPage = lazy(() => import("./pages/MatchDetailPage"));
const MatchFormPage = lazy(() => import("./pages/MatchFormPage"));
const TeamListPage = lazy(() => import("./pages/TeamListPage"));
const AdminListPage = lazy(() => import("./pages/AdminListPage"));
const routerBaseName = import.meta.env.BASE_URL.replace(/\/$/, "") || "/";

function LoadingPage() {
  return <div className="route-loading" aria-label="页面加载中" />;
}

export default function App() {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#28704b",
          colorInfo: "#28704b",
          borderRadius: 4,
          fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
        },
      }}
    >
      <BrowserRouter basename={routerBaseName}>
        <AuthProvider>
          <Suspense fallback={<LoadingPage />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedLayout />}>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/access" element={<AccessPage />} />
                <Route path="/matches" element={<MatchListPage />} />
                <Route path="/matches/new" element={<MatchFormPage />} />
                <Route path="/matches/:id" element={<MatchDetailPage />} />
                <Route path="/matches/:id/edit" element={<MatchFormPage />} />
                <Route path="/teams" element={<TeamListPage />} />
                <Route path="/admins" element={<AdminListPage />} />
              </Route>
              <Route path="/404" element={<Result status="404" title="404" subTitle="页面不存在" />} />
              <Route path="*" element={<Navigate to="/404" replace />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </ConfigProvider>
  );
}
