import axios, {
  type AxiosInstance,
  type InternalAxiosRequestConfig,
  type AxiosRequestConfig,
} from 'axios'
import { getToken, removeToken } from '@/utils/auth'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

const instance: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api/admin`,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
})

instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getToken()
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

instance.interceptors.response.use(
  (response) => {
    // 后端统一包装：{ success, message, data }
    const body = response.data
    if (body && typeof body === 'object' && 'data' in body) {
      return body.data
    }
    return body
  },
  (error) => {
    let message = '请求失败'
    if (error.response) {
      const { status, data } = error.response
      if (status === 401) {
        message = '登录已过期，请重新登录'
        removeToken()
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login'
        }
      } else if (status === 403) {
        message = '权限不足'
      } else {
        message = data?.message || data?.error || `请求失败 (${status})`
      }
    } else if (error.request) {
      message = '网络错误，请检查网络连接'
    }
    error.message = message
    return Promise.reject(error)
  },
)

const get = <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
  instance.get(url, config) as unknown as Promise<T>

const post = <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> =>
  instance.post(url, data, config) as unknown as Promise<T>

const put = <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> =>
  instance.put(url, data, config) as unknown as Promise<T>

const patch = <T>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> =>
  instance.patch(url, data, config) as unknown as Promise<T>

const del = <T>(url: string, config?: AxiosRequestConfig): Promise<T> =>
  instance.delete(url, config) as unknown as Promise<T>

export const http = { get, post, put, patch, delete: del }
