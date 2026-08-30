interface RedirectLocation {
  pathname: string;
  search?: string;
  hash?: string;
}

function normalizeRouteBase(routeBase: string) {
  const normalized = routeBase.trim() || "/";
  if (normalized === "/") return normalized;
  return `/${normalized.replace(/^\/+|\/+$/g, "")}/`;
}

export function sanitizeRedirect(
  redirect: string | null | undefined,
  routeBase = import.meta.env.ADMIN_ROUTE_BASE || "/",
) {
  if (!redirect?.startsWith("/") || redirect.startsWith("//")) return "/";

  const base = normalizeRouteBase(routeBase);
  if (base === "/") return redirect;

  const basePrefix = base.slice(0, -1);
  if (redirect === basePrefix) return "/";
  if (redirect.startsWith(`${basePrefix}/`)) {
    return redirect.slice(basePrefix.length) || "/";
  }
  return redirect;
}

export function buildLoginUrl(
  location: RedirectLocation,
  routeBase = import.meta.env.ADMIN_ROUTE_BASE || "/",
) {
  const destination = sanitizeRedirect(
    `${location.pathname}${location.search || ""}${location.hash || ""}`,
    routeBase,
  );
  return `/login?redirect=${encodeURIComponent(destination)}`;
}
