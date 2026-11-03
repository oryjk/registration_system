/** 微信 onLoad 保留路由参数的编码；H5 路由已解码，必须保持原值。 */
export function readWebViewPageQuery(query: Record<string, unknown> | undefined, encoded = false) {
  const readValue = (value: unknown): string => {
    if (typeof value !== "string") return "";
    if (!encoded) return value.trim();
    try {
      return decodeURIComponent(value).trim();
    } catch {
      return "";
    }
  };
  return { url: readValue(query?.url), title: readValue(query?.title) };
}
