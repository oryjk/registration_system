import { http } from '@/utils/request'

export interface AdminUser {
  id: number
  username: string
  nickname: string
  status: number
  is_super_admin: boolean
}

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  access_token: string
  token_type: string
  admin: AdminUser
}

export interface RegisterRequest {
  username: string
  password: string
  nickname?: string
  is_super_admin?: boolean
}

export interface UpdateStatusRequest {
  status: number
}

export interface VerifyResponse {
  admin_id: number
  admin: AdminUser
}

export const login = (data: LoginRequest) => http.post<LoginResponse>('/auth/login', data)

export const verifyToken = () => http.post<VerifyResponse>('/auth/verify')

export const register = (data: RegisterRequest) => http.post<AdminUser>('/auth/register', data)

export const listAdmins = () => http.get<AdminUser[]>('/auth/admins')

export const updateAdminStatus = (id: number, data: UpdateStatusRequest) =>
  http.patch<void>(`/auth/admins/${id}/status`, data)

export const deleteAdmin = (id: number) => http.delete<void>(`/auth/admins/${id}`)
