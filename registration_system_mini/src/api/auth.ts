import type { LoginResponse, TestLoginUsersResponse } from "@/types/app";
import { requestApi } from "@/utils/request";

export function wechatLogin(jsCode: string) {
  return requestApi<LoginResponse>({
    url: "/auth/wechat/login",
    method: "POST",
    data: { js_code: jsCode },
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
