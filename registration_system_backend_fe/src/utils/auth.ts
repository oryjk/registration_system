const TOKEN_KEY = 'admin_token'
const ADMIN_KEY = 'admin_info'

export interface AdminInfo {
  id: number
  username: string
  nickname: string
  is_super_admin: boolean
}

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY)

export const setToken = (token: string) => localStorage.setItem(TOKEN_KEY, token)

export const removeToken = () => {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(ADMIN_KEY)
}

export const getAdminInfo = (): AdminInfo | null => {
  const raw = localStorage.getItem(ADMIN_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export const setAdminInfo = (info: AdminInfo) => {
  localStorage.setItem(ADMIN_KEY, JSON.stringify(info))
}

export const isSuperAdmin = (): boolean => getAdminInfo()?.is_super_admin ?? false
