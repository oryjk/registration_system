/**
 * 缠观（行情结构分析 H5）入口配置。
 *
 * 缠观部署在既有 web-view 业务域名 `match.oryjk.cn` 的 `/chanlun/` 路径下，
 * 无需在公众平台新增业务域名；本地联调可用 VITE_CHANLUN_H5_URL 指向开发服务器。
 */
export const DEFAULT_CHANLUN_H5_URL = "https://match.oryjk.cn/chanlun/";

/** 缠观回跳参数与后端 /mini-links/chanlun 的校验规则保持一致。 */
const RETURN_QUERY_PATTERN = /^[A-Za-z0-9._=&-]*$/;
const MAX_RETURN_QUERY_LENGTH = 512;

export function getChanlunH5Url(): string {
  return import.meta.env.VITE_CHANLUN_H5_URL?.trim() || DEFAULT_CHANLUN_H5_URL;
}

/** 只接受缠观自身的查询串（如 secid=1.600519&timeframe=30m），其余一律丢弃，防止被用作任意跳转。 */
export function sanitizeChanlunReturnQuery(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  const query = value.trim().replace(/^\?/, "");
  if (query.length > MAX_RETURN_QUERY_LENGTH || !RETURN_QUERY_PATTERN.test(query)) {
    return "";
  }
  return query;
}

export function buildChanlunUrl(returnQuery: unknown, baseUrl = getChanlunH5Url()): string {
  const query = sanitizeChanlunReturnQuery(returnQuery);
  if (!query) {
    return baseUrl;
  }
  return `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}${query}`;
}
