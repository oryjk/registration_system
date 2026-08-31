import type { LoginResponse, TestLoginUsersResponse, WebViewCodeResponse, WebViewExchangeResponse, ImpersonationTargetsResponse } from "@/types/app";
import { requestApi } from "@/utils/request";

export function wechatLogin(jsCode: string) {
  return requestApi<LoginResponse>({
    url: "/auth/wechat/login",
    method: "POST",
    data: { js_code: jsCode },
  });
}

/** web-view 桥接：签发一次性 code（需登录态，走 Bearer 头）。 */
export function createWebViewCode() {
  return requestApi<WebViewCodeResponse>({
    url: "/auth/webview-codes",
    method: "POST",
    auth: true,
  });
}

/** web-view 桥接：H5 侧用一次性 code 换 token（公开接口）。 */
export function exchangeWebViewCode(code: string) {
  return requestApi<WebViewExchangeResponse>({
    url: "/auth/webview-codes/exchange",
    method: "POST",
    data: { code },
  });
}

export function listTestLoginUsers() {
  return requestApi<TestLoginUsersResponse>({
    url: "/test-auth/users",
  });
}

export function testLogin(userId: number) {
  return requestApi<LoginResponse>({
    url: "/test-auth/login",
    method: "POST",
    data: { user_id: userId },
  });
}

/** 身份切换（调试）：搜索可切换的目标用户；仅后端白名单账号可用。 */
export function searchImpersonationTargets(keyword: string) {
  return requestApi<ImpersonationTargetsResponse>({
    url: "/auth/impersonation/targets",
    method: "GET",
    data: { keyword },
    auth: true,
  });
}

/** 身份切换（调试）：换取目标用户的登录 token；仅后端白名单账号可用。 */
export function impersonateUser(userId: number) {
  return requestApi<LoginResponse>({
    url: "/auth/impersonation",
    method: "POST",
    data: { user_id: userId },
    auth: true,
  });
}
