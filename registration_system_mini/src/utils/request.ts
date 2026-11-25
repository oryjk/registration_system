import { buildAppApiUrl, getApiBaseUrl, getBackupApiBaseUrl, getSecondBackupApiBaseUrl } from "@/config/apiBase";
import { createApiRouter } from "@/config/apiRouter";
import { getAccessToken } from "@/utils/authStorage";
// #ifdef H5
import { isMockEnabled, tryMockRequest } from "@/mock";
// #endif
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
const REQUEST_TIMEOUT_MS = 15_000;
const HEALTH_TIMEOUT_MS = 3_000;

let configuredRouter: {
  primary: string;
  backup: string | undefined;
  secondBackup: string | undefined;
  router: ReturnType<typeof createApiRouter>;
} | undefined;

function getRouter(primary: string) {
  const backup = getBackupApiBaseUrl();
  const secondBackup = getSecondBackupApiBaseUrl();
  if (configuredRouter?.primary !== primary || configuredRouter.backup !== backup
    || configuredRouter.secondBackup !== secondBackup) {
    const backups = [backup, secondBackup].filter((base): base is string => Boolean(base) && base !== primary);
    if (!backups.length) return undefined;
    configuredRouter = {
      primary,
      backup,
      secondBackup,
      router: createApiRouter(primary, backups, (error) =>
        error instanceof ApiRequestError && (error.networkFailed || [502, 503, 504].includes(error.statusCode)),
      ),
    };
  }
  return configuredRouter.router;
}

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
  const absolute = /^https?:\/\//i.test(options.url);
  const primary = absolute ? undefined : getApiBaseUrl();
  const requestUrl = primary ? buildAppApiUrl(primary, options.url) : options.url;

  // Mock 拦截：开发环境下通过 VITE_USE_MOCK 开启。
  // 开启后必须“全有或全无”：未覆盖的接口直接报错，不允许回落到真实后端，
  // 否则页面会混显 mock 数据和真实数据，误导联调判断。
  // #ifdef H5
  if (isMockEnabled()) {
    const mockResult = tryMockRequest(method, requestUrl, options.data);
    if (mockResult === null) {
      return Promise.reject(new ApiRequestError(`mock 模式未覆盖该接口: ${method} ${options.url}`, 0));
    }
    return mockResult as Promise<TResponse>;
  }
  // #endif

  try {
    const router = primary ? getRouter(primary) : undefined;
    if (!router) return await sendRequest<TResponse>(requestUrl, method, options.data, token);

    const send = (base: string) => sendRequest<TResponse>(buildAppApiUrl(base, options.url), method, options.data, token);
    return await (method === "GET" ? router.read(send) : router.write(send, probeHealth));
  } catch (error) {
    if (error instanceof ApiRequestError && error.networkFailed) showNetworkUnavailableDialog(error.message);
    throw error;
  }
}

function sendRequest<TResponse>(
  url: string,
  method: RequestMethod,
  data: RequestPayload,
  token: string,
  timeout = REQUEST_TIMEOUT_MS,
): Promise<TResponse> {
  return new Promise<TResponse>((resolve, reject) => {
    uni.request({
      url,
      method: method as never,
      data,
      timeout,
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
        const message = normalizeNetworkFailureMessage(error.errMsg || "");
        reject(new ApiRequestError(message, 0, true));
      },
    });
  });
}

async function probeHealth(base: string): Promise<void> {
  const url = base.replace(/\/api\/v1\/app$/i, "/health");
  const payload = await sendRequest<BackendApiResponse<{ status: string }>>(url, "GET", undefined, "", HEALTH_TIMEOUT_MS);
  if (payload?.code !== 0 || payload.data?.status !== "ok") {
    throw new ApiRequestError("服务暂时不可用", 503);
  }
}

export function uploadThroughAppApi<T>(path: string, upload: (url: string) => Promise<T>): Promise<T> {
  const primary = getApiBaseUrl();
  const router = getRouter(primary);
  const send = (base: string) => upload(buildAppApiUrl(base, path));
  return router ? router.write(send, probeHealth) : send(primary);
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
