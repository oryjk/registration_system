import type { AdminUser } from "./auth";

export interface RuntimeInitialState {
  currentAdmin: AdminUser | null;
  authBootstrapError: string | null;
  fetchCurrentAdmin: () => Promise<AdminUser | null>;
}
