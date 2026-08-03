import { clearAdminToken, getAdminToken } from "../auth/token-storage";
import { getApiBaseUrl } from "../config/api";
import type { ApiResponse } from "../types/api";

interface RequestOptions extends RequestInit {
  admin?: boolean;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: number;

  constructor(message: string, status = 0, code = -1) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { admin = true, headers, ...requestOptions } = options;
  const prefix = admin ? "/api/admin" : "";
  const token = admin ? getAdminToken() : null;
  const response = await fetch(`${getApiBaseUrl()}${prefix}${path}`, {
    ...requestOptions,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  let body: Partial<ApiResponse<T>> | undefined;
  try {
    body = (await response.json()) as Partial<ApiResponse<T>>;
  } catch {
    const message = response.ok
      ? "服务响应无法解析"
      : `服务不可达 (${response.status})`;
    throw new ApiError(message, response.status);
  }

  if (!response.ok || body.code !== 0) {
    if (response.status === 401 && admin) {
      clearAdminToken();
      window.dispatchEvent(new Event("admin-auth-expired"));
    }
    throw new ApiError(
      body.message || `请求失败 (${response.status})`,
      response.status,
      body.code ?? -1,
    );
  }
  return body.data as T;
}
