import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import { getApiBaseUrl } from "@/config/api";
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

function createAdminQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  const [authBootstrapError, setAuthBootstrapError] = useState<string | null>(
    null,
  );
  const [bootstrapping, setBootstrapping] = useState(true);
  const [queryClient, setQueryClient] = useState(createAdminQueryClient);
  const navigate = useNavigate();
  const location = useLocation();

  const resetQueries = useCallback(() => {
    queryClient.clear();
    setQueryClient(createAdminQueryClient());
  }, [queryClient]);

  const refresh = useCallback(async () => {
    const token = getAdminToken();
    const baseUrl = getApiBaseUrl();
    const sessionChanged = () =>
      token !== getAdminToken() || baseUrl !== getApiBaseUrl();
    setBootstrapping(true);
    setAuthBootstrapError(null);
    try {
      const admin = await fetchCurrentAdmin();
      if (sessionChanged()) return;
      setCurrentAdmin(admin);
      setBootstrapping(false);
    } catch (reason) {
      if (sessionChanged()) return;
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
    resetQueries();
    setCurrentAdmin(null);
    setAuthBootstrapError(null);
    setBootstrapping(false);
    navigate("/login");
  }, [navigate, resetQueries]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handleSessionExpired = () => {
      resetQueries();
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
  }, [location, navigate, resetQueries]);

  const login = useCallback(
    (admin: AdminUser) => {
      resetQueries();
      setCurrentAdmin(admin);
      setAuthBootstrapError(null);
      setBootstrapping(false);
    },
    [resetQueries],
  );

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
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
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
