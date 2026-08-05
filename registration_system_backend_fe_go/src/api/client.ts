import { expireAdminSession } from "../auth/session-expiry";
import { getAdminToken } from "../auth/token-storage";
import { type AuthMode, buildApiUrl, getApiBaseUrl } from "../config/api";
import type { ApiResponse } from "../types/api";

export interface RequestOptions extends RequestInit {
  auth?: AuthMode;
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
  const { auth = "required", headers, ...requestOptions } = options;
  const token = auth === "required" ? getAdminToken() : null;
  const response = await fetch(buildApiUrl(getApiBaseUrl(), auth, path), {
    ...requestOptions,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (response.status === 401 && auth === "required") {
    expireAdminSession();
  }

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
    throw new ApiError(
      body.message || `请求失败 (${response.status})`,
      response.status,
      body.code ?? -1,
    );
  }
  return body.data as T;
}
