import { getApiBaseUrl } from "@/config/apiBase";
import { getAccessToken } from "@/utils/authStorage";
import type { BackendApiResponse } from "@/types/backend";

type RequestMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type RequestPayload = string | Record<string, unknown> | ArrayBuffer | undefined;

interface RequestOptions<TBody extends RequestPayload> {
  url: string;
  method?: RequestMethod;
  data?: TBody;
  auth?: boolean;
}

export class ApiRequestError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 0) {
    super(message);
    this.name = "ApiRequestError";
    this.statusCode = statusCode;
  }
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiRequestError && (error.statusCode === 401 || error.statusCode === 403);
}

export async function requestRaw<TResponse, TBody extends RequestPayload = Record<string, unknown>>(
  options: RequestOptions<TBody>,
): Promise<TResponse> {
  const token = options.auth ? getAccessToken() : "";
  const requestUrl = /^https?:\/\//i.test(options.url) ? options.url : `${getApiBaseUrl()}${options.url}`;

  return new Promise<TResponse>((resolve, reject) => {
    uni.request({
      url: requestUrl,
      method: (options.method ?? "GET") as never,
      data: options.data,
      header: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      success: (response) => {
        const { statusCode, data } = response;
        if (statusCode >= 200 && statusCode < 300) {
          resolve(data as TResponse);
          return;
        }

        const message =
          typeof data === "object" && data && "message" in data
            ? String((data as { message?: string }).message || "请求失败")
            : `请求失败(${statusCode})`;

        reject(new ApiRequestError(message, statusCode));
      },
      fail: (error) => {
        reject(new ApiRequestError(error.errMsg || "网络请求失败"));
      },
    });
  });
}

export async function requestApi<TResponse, TBody extends RequestPayload = Record<string, unknown>>(
  options: RequestOptions<TBody>,
): Promise<TResponse> {
  const response = await requestRaw<BackendApiResponse<TResponse>, TBody>(options);
  if (!response.success) {
    throw new ApiRequestError(response.message || "请求失败");
  }

  return (response.data ?? null) as TResponse;
}

export const request = requestRaw;
