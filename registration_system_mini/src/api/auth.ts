import type { LoginResponse, TestLoginUsersResponse, WebViewCodeResponse, WebViewExchangeResponse } from "@/types/app";
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
