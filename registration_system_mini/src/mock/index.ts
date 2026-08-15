/**
 * Mock 模式总入口。
 *
 * 通过环境变量 VITE_USE_MOCK 控制全局开关。
 * 仅用于 H5 开发环境的前后端分离独立开发，小程序构建和生产构建不开启。
 */

import type { BackendApiResponse } from "@/types/backend";
import { resolveMockResponse } from "./handlers";

export { resolveMockResponse } from "./handlers";

/** 判断 mock 模式是否开启 */
export function isMockEnabled(): boolean {
  return import.meta.env.VITE_USE_MOCK === "true";
}

/** mock 请求模拟延迟（ms），让加载状态接近真实手感 */
const MOCK_DELAY_MS_MIN = 80;
const MOCK_DELAY_MS_MAX = 250;

function randomDelay(): number {
  return MOCK_DELAY_MS_MIN + Math.random() * (MOCK_DELAY_MS_MAX - MOCK_DELAY_MS_MIN);
}

/**
 * 尝试用 mock 数据响应请求。
 *
 * @param method HTTP 方法
 * @param url 完整 URL 或路径（如 "/activity/infos?page=1" 或 "http://localhost:18080/api/activity/infos"）
 * @param body 请求体
 * @returns mock 响应 Promise，或 null 表示未命中（交由真实网络请求）
 */
export function tryMockRequest(
  method: string,
  url: string,
  body?: unknown,
): Promise<BackendApiResponse<unknown>> | null {
  const path = extractApiPath(url);
  if (path === null) return null;

  const mockResponse = resolveMockResponse(method, path, body);
  if (mockResponse === null) {
    console.warn(`[mock] 未命中的请求: ${method} ${path}`);
    return null;
  }

  return new Promise((resolve) => {
    setTimeout(() => resolve(mockResponse), randomDelay());
  });
}

/**
 * 从完整 URL 中提取 API 路径（去除 baseURL 前缀和协议/host）。
 * 支持 "http://127.0.0.1:8080/api/v1/app/matches/home" → "/matches/home"
 */
function extractApiPath(url: string): string | null {
  // 去除协议和 host
  let path = url;
  const protocolIndex = path.indexOf("://");
  if (protocolIndex !== -1) {
    const afterProtocol = path.slice(protocolIndex + 3);
    const slashIndex = afterProtocol.indexOf("/");
    if (slashIndex === -1) return null;
    path = afterProtocol.slice(slashIndex);
  }

  // 去除 App baseURL 中的 "/api/v1/app" 或旧的 "/api" 前缀（如果有）
  if (path.startsWith("/api/v1/app/")) {
    path = path.slice("/api/v1/app".length);
  } else if (path === "/api/v1/app") {
    return "/";
  }

  if (path.startsWith("/api/")) {
    path = path.slice(4);
  } else if (path === "/api") {
    return "/";
  }

  return path;
}
