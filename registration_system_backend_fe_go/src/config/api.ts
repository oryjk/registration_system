export type AuthMode = "required" | "login" | "none";

const ADMIN_API_PREFIX = "/api/v1/admin";
const SERVER_KEY = "registration-admin-go.server.v1";

type AdminServerId = "default" | "alternate";

interface AdminServer {
  id: AdminServerId;
  label: string;
  baseUrl: string;
}

const defaultServer: AdminServer = {
  id: "default",
  label: import.meta.env.ADMIN_API_SERVER_LABEL?.trim() || "默认服务器",
  baseUrl: (import.meta.env.ADMIN_API_BASE_URL?.trim() || "").replace(
    /\/+$/,
    "",
  ),
};
const alternateBaseUrl = (
  import.meta.env.ADMIN_API_ALTERNATE_BASE_URL?.trim() || ""
).replace(/\/+$/, "");

export const adminServers: readonly AdminServer[] =
  alternateBaseUrl && alternateBaseUrl !== defaultServer.baseUrl
    ? [
        defaultServer,
        {
          id: "alternate",
          label:
            import.meta.env.ADMIN_API_ALTERNATE_SERVER_LABEL?.trim() ||
            "备用服务器",
          baseUrl: alternateBaseUrl,
        },
      ]
    : [defaultServer];

let activeServer: AdminServer | undefined;

export function findAdminServer(id: string | null): AdminServer {
  return adminServers.find((server) => server.id === id) ?? defaultServer;
}

export function getAdminServer(): AdminServer {
  activeServer ??= findAdminServer(
    adminServers.length > 1 ? window.localStorage.getItem(SERVER_KEY) : null,
  );
  return activeServer;
}

export function setAdminServer(id: AdminServerId) {
  activeServer = findAdminServer(id);
  if (adminServers.length > 1) {
    window.localStorage.setItem(SERVER_KEY, activeServer.id);
  }
}

export function getApiBaseUrl(): string {
  return getAdminServer().baseUrl;
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
