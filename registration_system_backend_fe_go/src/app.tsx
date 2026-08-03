import type { ReactNode } from "react";
import { getCurrentAdmin } from "./api/auth";
import { ApiError } from "./api/client";
import { expireAdminSession } from "./auth/session-expiry";
import { getAdminToken } from "./auth/token-storage";
import type { RuntimeInitialState } from "./types/runtime";

export async function fetchCurrentAdmin() {
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
