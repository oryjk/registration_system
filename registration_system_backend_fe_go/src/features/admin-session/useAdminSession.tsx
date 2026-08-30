import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useLocation, useNavigate } from "react-router";
import { getCurrentAdmin } from "@/api/auth";
import { ApiError } from "@/api/client";
import { expireAdminSession } from "@/auth/session-expiry";
import { clearAdminToken, getAdminToken } from "@/auth/token-storage";
import type { AdminUser } from "@/types/auth";
import { buildLoginUrl } from "@/utils/auth-redirect";

export function isPublicRoute(pathname: string) {
  return pathname === "/login" || pathname === "/403" || pathname === "/404";
}

async function fetchCurrentAdmin(): Promise<AdminUser | null> {
  if (!getAdminToken()) return null;
  return getCurrentAdmin();
}

interface AdminSessionContextValue {
  currentAdmin: AdminUser | null;
  authBootstrapError: string | null;
  bootstrapping: boolean;
  refresh: () => Promise<void>;
  logout: () => void;
  login: (admin: AdminUser) => void;
}

const AdminSessionContext = createContext<AdminSessionContextValue | null>(
  null,
);

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  const [authBootstrapError, setAuthBootstrapError] = useState<string | null>(
    null,
  );
  const [bootstrapping, setBootstrapping] = useState(true);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();

  const refresh = useCallback(async () => {
    setBootstrapping(true);
    setAuthBootstrapError(null);
    try {
      setCurrentAdmin(await fetchCurrentAdmin());
      setBootstrapping(false);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        expireAdminSession();
        return;
      }
      setCurrentAdmin(null);
      setAuthBootstrapError(
        reason instanceof Error ? reason.message : "管理员信息加载失败",
      );
      setBootstrapping(false);
    }
  }, []);

  const logout = useCallback(() => {
    clearAdminToken();
    queryClient.clear();
    setCurrentAdmin(null);
    setAuthBootstrapError(null);
    setBootstrapping(false);
    navigate("/login");
  }, [navigate, queryClient]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handleSessionExpired = () => {
      queryClient.clear();
      setCurrentAdmin(null);
      setAuthBootstrapError(null);
      setBootstrapping(false);
      if (!isPublicRoute(location.pathname)) {
        navigate(buildLoginUrl(location));
      }
    };
    window.addEventListener("admin-auth-expired", handleSessionExpired);
    return () => {
      window.removeEventListener("admin-auth-expired", handleSessionExpired);
    };
  }, [location, navigate, queryClient]);

  const login = useCallback((admin: AdminUser) => {
    setCurrentAdmin(admin);
    setAuthBootstrapError(null);
    setBootstrapping(false);
  }, []);

  return (
    <AdminSessionContext.Provider
      value={{
        currentAdmin,
        authBootstrapError,
        bootstrapping,
        refresh,
        logout,
        login,
      }}
    >
      {children}
    </AdminSessionContext.Provider>
  );
}

export function useAdminSession(): AdminSessionContextValue {
  const context = useContext(AdminSessionContext);
  if (!context) {
    throw new Error("useAdminSession must be used within AdminSessionProvider");
  }
  return context;
}
