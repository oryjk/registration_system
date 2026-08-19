import { buildAppApiUrl, getApiBaseUrl } from "@/config/apiBase";
import { getAccessToken } from "@/utils/authStorage";
import { isMockEnabled, tryMockRequest } from "@/mock";
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
  /** 网络层失败（断网/超时），区别于后端返回的业务错误。 */
  networkFailed: boolean;

  constructor(message: string, statusCode = 0, networkFailed = false) {
    super(message);
    this.name = "ApiRequestError";
    this.statusCode = statusCode;
    this.networkFailed = networkFailed;
  }
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiRequestError && error.statusCode === 401;
}

export function isNetworkUnavailableError(error: unknown): boolean {
  return error instanceof ApiRequestError && error.networkFailed;
}

const NETWORK_UNAVAILABLE_MESSAGE = "网络连接不可用，请检查网络后重试";
const NETWORK_TIMEOUT_MESSAGE = "网络连接超时，请检查网络后重试";

/** 断网/超时的 errMsg 形如 "request:fail " / "request:fail timeout"，统一转成用户能看懂的提示。 */
function normalizeNetworkFailureMessage(errMsg: string): string {
  return errMsg.includes("timeout") ? NETWORK_TIMEOUT_MESSAGE : NETWORK_UNAVAILABLE_MESSAGE;
}

/** 断网时并发请求会一起失败，全局只弹一个提示框，关闭后再次失败才重新弹。 */
let networkErrorDialogVisible = false;

function showNetworkUnavailableDialog(content: string) {
  if (networkErrorDialogVisible) return;
  networkErrorDialogVisible = true;
  uni.showModal({
    title: "网络不可用",
    content,
    showCancel: false,
    confirmText: "知道了",
    complete: () => {
      networkErrorDialogVisible = false;
    },
  });
}

export async function requestRaw<TResponse, TBody extends RequestPayload = Record<string, unknown>>(
  options: RequestOptions<TBody>,
): Promise<TResponse> {
  const token = options.auth ? getAccessToken() : "";
  const method = options.method ?? "GET";
  const requestUrl = /^https?:\/\//i.test(options.url) ? options.url : buildAppApiUrl(getApiBaseUrl(), options.url);

  // Mock 拦截：开发环境下通过 VITE_USE_MOCK 开启。
  // 开启后必须“全有或全无”：未覆盖的接口直接报错，不允许回落到真实后端，
  // 否则页面会混显 mock 数据和真实数据，误导联调判断。
  if (isMockEnabled()) {
    const mockResult = tryMockRequest(method, requestUrl, options.data);
    if (mockResult === null) {
      return Promise.reject(new ApiRequestError(`mock 模式未覆盖该接口: ${method} ${options.url}`, 0));
    }
    return mockResult as Promise<TResponse>;
  }

  return new Promise<TResponse>((resolve, reject) => {
    uni.request({
      url: requestUrl,
      method: method as never,
      data: options.data,
      // 显式 15s 超时：默认 60s 会让断网场景干等太久才看到失败提示。
      timeout: 15000,
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
        // 断网/超时不再透传晦涩的 errMsg：归一成明确文案并弹窗告知，页面 toast 同样显示这句话。
        const message = normalizeNetworkFailureMessage(error.errMsg || "");
        showNetworkUnavailableDialog(message);
        reject(new ApiRequestError(message, 0, true));
      },
    });
  });
}

export async function requestApi<TResponse, TBody extends RequestPayload = Record<string, unknown>>(
  options: RequestOptions<TBody>,
): Promise<TResponse> {
  const response = await requestRaw<BackendApiResponse<TResponse>, TBody>(options);
  if (response.code !== 0) {
    throw new ApiRequestError(response.message || "请求失败", response.code || 0);
  }

  return (response.data ?? null) as TResponse;
}

export const request = requestRaw;
