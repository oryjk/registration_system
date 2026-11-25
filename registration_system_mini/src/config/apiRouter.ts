const PRIMARY_RECHECK_MS = 60_000;

type Route = { base: string; recheckAt: number };

export function createApiRouter(
  primary: string,
  backups: string | readonly string[],
  isUnavailable: (error: unknown) => boolean,
  now = Date.now,
) {
  const origins = [...new Set([primary, ...(typeof backups === "string" ? [backups] : backups)])];
  let active: Route | undefined;
  let pendingProbe: Promise<void> | undefined;

  function remember(base: string, observed: Route | undefined) {
    // An earlier request can finish after another request has already switched hosts.
    if (active !== observed) return;
    if (active?.base === base && (base === primary || now() < active.recheckAt)) return;
    active = { base, recheckAt: base === primary ? 0 : now() + PRIMARY_RECHECK_MS };
  }

  async function read<T>(send: (base: string) => Promise<T>): Promise<T> {
    const observed = active;
    const first = observed && now() < observed.recheckAt ? observed.base : primary;
    const candidates = [first, ...origins.filter((base) => base !== first)];
    let lastError: unknown;
    for (const base of candidates) {
      try {
        const result = await send(base);
        remember(base, observed);
        return result;
      } catch (error) {
        if (!isUnavailable(error)) throw error;
        lastError = error;
      }
    }
    throw lastError;
  }

  async function write<T>(send: (base: string) => Promise<T>, probe: (base: string) => Promise<void>): Promise<T> {
    if (!active) {
      pendingProbe ??= read(probe).finally(() => { pendingProbe = undefined; });
      await pendingProbe;
    }
    const observed = active;
    try {
      return await send(observed?.base ?? primary);
    } catch (error) {
      // The server may have committed the write before the connection failed.
      if (active === observed && isUnavailable(error)) active = undefined;
      throw error;
    }
  }

  return { read, write };
}
