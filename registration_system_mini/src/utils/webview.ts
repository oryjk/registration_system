import { createWebViewCode, exchangeWebViewCode } from "@/api/auth";
import {
  getAccessToken,
  getCurrentIdentitySelection,
  setAccessToken,
  setCurrentIdentitySelection,
} from "@/utils/authStorage";

/**
 * web-view 嵌入 H5 的桥接工具（一次性 code 方案）。
 *
 * 小程序端 `navigateToWebView` 先用当前登录态调后端签发一次性 code
 * （POST /auth/webview-codes，60s 有效、仅可消费一次），把 code 拼进目标
 * H5 URL query；H5 端启动时由 `ingestWebViewAuthFromUrl` 读参并调
 * POST /auth/webview-codes/exchange 换正式 token 写入本地存储。
 * token 全程不出现在 URL / nginx access log 里。
 */

/** web-view 允许打开的 H5 域名白名单，防止嵌页被当成任意网页跳板。 */
const ALLOWED_WEBVIEW_HOSTS = ["match.oryjk.cn"];
/** 本地开发调试允许的 host（不要求 https）。 */
const LOCAL_DEV_HOSTS = ["localhost", "127.0.0.1"];

/** URL query 参数名：小程序→H5 的桥接参数统一带 webview_ 前缀。 */
export const WEBVIEW_CODE_PARAM = "webview_code";
export const WEBVIEW_IDENTITY_KIND_PARAM = "webview_identity_kind";
export const WEBVIEW_IDENTITY_TEAM_ID_PARAM = "webview_identity_team_id";

function isLocalDevHost(hostname: string): boolean {
  return LOCAL_DEV_HOSTS.includes(hostname);
}

/** 解析 URL 的 protocol 与 host。小程序 JSCore 对 URL 构造器支持不稳定，统一用正则解析。 */
function parseUrlParts(targetUrl: string): { protocol: string; hostname: string } | null {
  const match = /^(https?):\/\/([^/?#:]+)(?::\d+)?([/?#]|$)/.exec(targetUrl.trim());
  if (!match) {
    return null;
  }
  return { protocol: match[1], hostname: match[2].toLowerCase() };
}

export function isAllowedWebViewUrl(targetUrl: string): boolean {
  const parts = parseUrlParts(targetUrl);
  if (!parts) {
    return false;
  }
  if (isLocalDevHost(parts.hostname)) {
    return true;
  }
  if (parts.protocol !== "https") {
    return false;
  }
  return ALLOWED_WEBVIEW_HOSTS.some(
    (host) => parts.hostname === host || parts.hostname.endsWith(`.${host}`),
  );
}

/** 往目标 H5 URL 拼接一次性 code 与当前身份选择（不含 token）。 */
export function buildWebViewTargetUrl(targetUrl: string, code: string): string {
  const params: string[] = [`${WEBVIEW_CODE_PARAM}=${encodeURIComponent(code)}`];
  const identity = getCurrentIdentitySelection();
  if (identity) {
    params.push(`${WEBVIEW_IDENTITY_KIND_PARAM}=${identity.kind}`);
    if (identity.kind === "team" && identity.teamId) {
      params.push(`${WEBVIEW_IDENTITY_TEAM_ID_PARAM}=${identity.teamId}`);
    }
  }
  const separator = targetUrl.includes("?") ? "&" : "?";
  // hash（若有）必须保持在 query 之后。
  const hashIndex = targetUrl.indexOf("#");
  if (hashIndex === -1) {
    return `${targetUrl}${separator}${params.join("&")}`;
  }
  return `${targetUrl.slice(0, hashIndex)}${separator}${params.join("&")}${targetUrl.slice(hashIndex)}`;
}

/**
 * 在小程序内通过 web-view 嵌页打开 H5 页面。
 * 已登录时先向后端换取一次性 code 再跳转；code 签发失败则中止并提示。
 * 目标 URL 不在白名单内时仅 toast 提示，不跳转。
 */
export async function navigateToWebView(targetUrl: string, title?: string): Promise<void> {
  if (!isAllowedWebViewUrl(targetUrl)) {
    uni.showToast({ title: "暂不支持打开该链接", icon: "none" });
    return;
  }

  let finalUrl = targetUrl;
  if (getAccessToken()) {
    try {
      const { code } = await createWebViewCode();
      finalUrl = buildWebViewTargetUrl(targetUrl, code);
    } catch {
      uni.showToast({ title: "登录态同步失败，请重试", icon: "none" });
      return;
    }
  }

  const query = [`url=${encodeURIComponent(finalUrl)}`];
  if (title) {
    query.push(`title=${encodeURIComponent(title)}`);
  }
  uni.navigateTo({ url: `/pages/webview/index?${query.join("&")}` });
}

let pendingIngest: Promise<void> | null = null;

/**
 * 等待 URL 桥接的 code 兑换完成（无桥接参数时立即 resolve）。
 * 会话初始化（appSession.ensureSessionReady）开始前必须 await，
 * 否则会与异步兑换竞态、误判成游客态。小程序端为空操作。
 */
export function waitWebViewAuthIngest(): Promise<void> {
  return pendingIngest ?? Promise.resolve();
}

/**
 * H5 启动早期调用：从当前页面 URL query 读取 web-view 桥接参数，
 * 立即抹掉地址栏参数（一次性 code 不留在历史记录/分享链接里），
 * 随后异步用 code 兑换正式 token 写入本地存储；兑换失败保持游客态。
 * 仅在 H5（有 window）环境生效，小程序端为空操作。
 */
export function ingestWebViewAuthFromUrl(): void {
  if (typeof window === "undefined") {
    return;
  }
  const search = window.location.search;
  if (!search) {
    return;
  }
  const params = new URLSearchParams(search);
  const code = params.get(WEBVIEW_CODE_PARAM);
  const identityKind = params.get(WEBVIEW_IDENTITY_KIND_PARAM);
  const identityTeamId = params.get(WEBVIEW_IDENTITY_TEAM_ID_PARAM);
  if (!code && !identityKind) {
    return;
  }

  params.delete(WEBVIEW_CODE_PARAM);
  params.delete(WEBVIEW_IDENTITY_KIND_PARAM);
  params.delete(WEBVIEW_IDENTITY_TEAM_ID_PARAM);
  const rest = params.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`,
  );

  if (identityKind === "venue") {
    setCurrentIdentitySelection({ kind: "venue" });
  } else if (identityKind === "team") {
    const teamId = Number(identityTeamId);
    if (Number.isFinite(teamId) && teamId > 0) {
      setCurrentIdentitySelection({ kind: "team", teamId });
    }
  }

  if (code) {
    pendingIngest = exchangeWebViewCode(code)
      .then(({ token }) => {
        setAccessToken(token);
      })
      .catch(() => {
        // code 失效/已消费或网络失败：保持游客态，页面走既有未登录路径。
      });
  }
}
