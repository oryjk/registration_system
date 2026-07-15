import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { getCurrentAdmin, loginAdmin } from "../api/auth";
import type { AdminUser } from "../types/auth";
import { AuthContext } from "./auth-context";
import { clearAdminToken, getAdminToken, setAdminToken } from "./token-storage";

let currentAdminRequest: ReturnType<typeof getCurrentAdmin> | null = null;

function loadCurrentAdmin() {
  if (!currentAdminRequest) {
    currentAdminRequest = getCurrentAdmin().finally(() => {
      currentAdminRequest = null;
    });
  }
  return currentAdminRequest;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(() => Boolean(getAdminToken()));

  const logout = useCallback(() => {
    clearAdminToken();
    setAdmin(null);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await loginAdmin(username, password);
    setAdminToken(result.access_token);
    setAdmin(result.admin);
  }, []);

  useEffect(() => {
    let active = true;
    if (getAdminToken()) {
      void loadCurrentAdmin()
        .then((currentAdmin) => {
          if (active) setAdmin(currentAdmin);
        })
        .catch(() => {
          if (active) logout();
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }
    const handleExpired = () => logout();
    window.addEventListener("admin-auth-expired", handleExpired);
    return () => {
      active = false;
      window.removeEventListener("admin-auth-expired", handleExpired);
    };
  }, [logout]);

  const value = useMemo(() => ({ admin, loading, login, logout }), [admin, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
