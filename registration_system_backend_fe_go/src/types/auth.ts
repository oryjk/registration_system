export type AdminRole = "admin" | "super_admin";
export type AdminStatus = "active" | "frozen";

export interface AdminUser {
  id: number;
  username: string;
  role: AdminRole;
  status: AdminStatus;
  is_super_admin: boolean;
  created_at: string;
}

export interface AdminLoginResult {
  access_token: string;
  token_type: "Bearer";
  admin: AdminUser;
}

export interface CreateAdminPayload {
  username: string;
  password: string;
}
