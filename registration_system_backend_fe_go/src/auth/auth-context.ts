import { createContext } from "react";
import type { AdminUser } from "../types/auth";

export interface AuthContextValue {
  admin: AdminUser | null;
  loading: boolean;
  login(username: string, password: string): Promise<void>;
  logout(): void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
