import { getApiBaseUrl } from "@/config/api";
import type { ApiResponse } from "@/types/api";
import { getAccessToken } from "@/utils/storage";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type Payload = Record<string, unknown> | undefined;

interface RequestOptions {
  path: string;
  method?: Method;
  data?: Payload;
  auth?: boolean;
  api?: boolean;
}

export class ApiError extends Error {
  statusCode: number;
  code: number;

  constructor(message: string, statusCode = 0, code = -1) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && (error.statusCode === 401 || error.statusCode === 403);
}

export async function request<T>({ path, method = "GET", data, auth = false, api = true }: RequestOptions): Promise<T> {
  const token = auth ? getAccessToken() : "";
  const prefix = api ? "/api" : "";

  return new Promise<T>((resolve, reject) => {
    uni.request({
      url: `${getApiBaseUrl()}${prefix}${path}`,
      method: method as never,
      data,
      header: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      success: ({ statusCode, data: rawData }) => {
        const body = rawData as Partial<ApiResponse<T>> | undefined;
        if (statusCode >= 200 && statusCode < 300 && body?.code === 0) {
          resolve(body.data as T);
          return;
        }
        reject(new ApiError(body?.message || `请求失败 (${statusCode})`, statusCode, body?.code ?? -1));
      },
      fail: (error) => reject(new ApiError(error.errMsg || "网络连接失败")),
    });
  });
}
