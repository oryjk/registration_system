import type { BackendWxMiniPaymentParams } from "@/types/backend";

export interface WxPaymentParams {
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: string;
  paySign: string;
}

export function normalizeWxPaymentParams(
  params: BackendWxMiniPaymentParams | Record<string, unknown> | null | undefined,
): WxPaymentParams | null {
  if (!params) {
    return null;
  }

  const raw = params as Record<string, unknown>;
  const timeStamp = String(raw.timeStamp ?? raw.time_stamp ?? "");
  const nonceStr = String(raw.nonceStr ?? raw.nonce_str ?? "");
  const packageValue = String(raw.package ?? "");
  const signType = String(raw.signType ?? raw.sign_type ?? "MD5");
  const paySign = String(raw.paySign ?? raw.pay_sign ?? "");

  if (!timeStamp || !nonceStr || !packageValue || !signType || !paySign) {
    return null;
  }

  return {
    timeStamp,
    nonceStr,
    package: packageValue,
    signType,
    paySign,
  };
}

/** 模拟支付哨兵签名；与 Go mock 网关（payment/adapters/mock/gateway.go）的跨端约定，
 *  识别到该值时跳过 wx.requestPayment。前端统一引用此常量，不要再写字面量。 */
export const MOCK_PAY_SIGN = "mock_sign_for_testing";

export function isMockWxPaymentParams(params: WxPaymentParams): boolean {
  return params.paySign === MOCK_PAY_SIGN;
}

export function requestWxPayment(params: WxPaymentParams): Promise<void> {
  return new Promise((resolve, reject) => {
    uni.requestPayment({
      provider: "wxpay",
      timeStamp: params.timeStamp,
      nonceStr: params.nonceStr,
      package: params.package,
      signType: params.signType,
      paySign: params.paySign,
      success: () => resolve(),
      fail: (error) => reject(error),
    });
  });
}

export function isPaymentCancelled(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "errMsg" in error &&
    typeof error.errMsg === "string" &&
    error.errMsg.includes("cancel")
  );
}
