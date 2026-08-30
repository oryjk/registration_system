export type AuthMode = "required" | "login" | "none";

const ADMIN_API_PREFIX = "/api/v1/admin";

export function getApiBaseUrl(): string {
  return (import.meta.env.ADMIN_API_BASE_URL?.trim() || "").replace(/\/+$/, "");
}

export function buildApiUrl(
  baseUrl: string,
  auth: AuthMode,
  path: string,
): string {
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, "");
  if (!path.startsWith("/")) {
    throw new Error("请求路径必须以 / 开头");
  }
  const normalizedPath = `/${path.replace(/^\/+/, "")}`;

  if (
    normalizedPath === ADMIN_API_PREFIX ||
    normalizedPath.startsWith(`${ADMIN_API_PREFIX}/`)
  ) {
    throw new Error("管理端请求路径不应重复包含 /api/v1/admin 前缀");
  }

  const prefix = auth === "none" ? "" : ADMIN_API_PREFIX;
  return `${normalizedBaseUrl}${prefix}${normalizedPath}`;
}
