import type { BackendWxLoginResponse, BackendWxPhoneNumberResponse } from "@/types/backend";
import { requestApi } from "@/utils/request";

export function wxLogin(jsCode: string) {
  return requestApi<BackendWxLoginResponse>({
    url: "/wx/login",
    method: "POST",
    data: {
      js_code: jsCode,
    },
  });
}

export function getPhoneNumber(code: string) {
  return requestApi<BackendWxPhoneNumberResponse>({
    url: "/wx/getPhoneNumber",
    method: "POST",
    data: {
      code,
    },
  });
}
