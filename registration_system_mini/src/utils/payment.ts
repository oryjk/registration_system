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

export function isMockWxPaymentParams(params: WxPaymentParams): boolean {
  return params.paySign === "mock_sign_for_testing";
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
