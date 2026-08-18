import type { BackendWxMiniPaymentParams } from "@/types/backend";

export interface WxPaymentParams {
  /** 微信 JSAPI 支付所需，H5 微信内置浏览器拉起支付时使用；小程序端由宿主自带。 */
  appId?: string;
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
  const appId = String(raw.appId ?? raw.app_id ?? "");

  if (!timeStamp || !nonceStr || !packageValue || !signType || !paySign) {
    return null;
  }

  return {
    appId: appId || undefined,
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
  // #ifdef MP-WEIXIN
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
  // #endif
  // #ifdef H5
  return requestWxPaymentInWeChatBrowser(params);
  // #endif
}

// #ifdef H5
type WeixinJSBridgeResponse = { err_msg: string };

interface WeixinJSBridgeLike {
  invoke(name: string, args: Record<string, unknown>, callback: (response: WeixinJSBridgeResponse) => void): void;
}

declare const WeixinJSBridge: WeixinJSBridgeLike | undefined;

/** uni.requestPayment 在 H5 端不存在；微信 JSAPI 支付只能在微信内置浏览器里
 *  通过 WeixinJSBridge 拉起，普通浏览器给出可理解的提示而不是报 API 不存在。 */
function requestWxPaymentInWeChatBrowser(params: WxPaymentParams): Promise<void> {
  if (!/MicroMessenger/i.test(navigator.userAgent)) {
    return Promise.reject(new Error("请在微信内打开本页面完成支付"));
  }
  if (!params.appId) {
    return Promise.reject(new Error("支付参数缺少 appId"));
  }
  return new Promise((resolve, reject) => {
    const invoke = () => {
      if (typeof WeixinJSBridge === "undefined") {
        reject(new Error("微信支付组件加载失败，请重试"));
        return;
      }
      WeixinJSBridge.invoke(
        "getBrandWCPayRequest",
        {
          appId: params.appId,
          timeStamp: params.timeStamp,
          nonceStr: params.nonceStr,
          package: params.package,
          signType: params.signType,
          paySign: params.paySign,
        },
        (response) => {
          // err_msg 形如 get_brand_wcpay_request:ok / :cancel / :fail，
          // 保留原样 reject，isPaymentCancelled 依此识别用户取消。
          if (response.err_msg === "get_brand_wcpay_request:ok") {
            resolve();
          } else {
            reject({ errMsg: response.err_msg });
          }
        },
      );
    };
    if (typeof WeixinJSBridge === "undefined") {
      document.addEventListener("WeixinJSBridgeReady", invoke, { once: true });
    } else {
      invoke();
    }
  });
}
// #endif

export function isPaymentCancelled(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "errMsg" in error &&
    typeof error.errMsg === "string" &&
    error.errMsg.includes("cancel")
  );
}
