import Spin from "antd/es/spin";
import { Navigate, useLocation } from "react-router-dom";
import { AppShell } from "../components/AppShell";
import { useAuth } from "./useAuth";

export function ProtectedLayout() {
  const { admin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="auth-loading"><Spin size="large" /></div>;
  }
  if (!admin) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <AppShell />;
}
