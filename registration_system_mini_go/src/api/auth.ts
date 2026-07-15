import { request } from "@/api/http";
import type { WechatLoginResult } from "@/types/api";

export function loginWithWechatCode(jsCode: string) {
  return request<WechatLoginResult>({
    path: "/auth/wechat/login",
    method: "POST",
    data: { js_code: jsCode },
  });
}
