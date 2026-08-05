import type { RuntimeInitialState } from "./types/runtime";

export default function access(initialState?: RuntimeInitialState) {
  return {
    isAuthenticated: Boolean(initialState?.currentAdmin),
    isSuperAdmin: Boolean(initialState?.currentAdmin?.is_super_admin),
  };
}
