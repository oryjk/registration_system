const PRIMARY_RECHECK_MS = 60_000;

type Route = { base: string; recheckAt: number };

export function createApiRouter(
  primary: string,
  backup: string,
  isUnavailable: (error: unknown) => boolean,
  now = Date.now,
) {
  let active: Route | undefined;
  let pendingProbe: Promise<void> | undefined;

  function remember(base: string, observed: Route | undefined) {
    // An earlier request can finish after another request has already switched hosts.
    if (active !== observed) return;
    if (active?.base === base && (base === primary || now() < active.recheckAt)) return;
    active = { base, recheckAt: base === backup ? now() + PRIMARY_RECHECK_MS : 0 };
  }

  async function read<T>(send: (base: string) => Promise<T>): Promise<T> {
    const observed = active;
    const first = observed?.base === backup && now() < observed.recheckAt ? backup : primary;
    try {
      const result = await send(first);
      remember(first, observed);
      return result;
    } catch (error) {
      if (!isUnavailable(error)) throw error;
    }

    const alternate = first === primary ? backup : primary;
    const result = await send(alternate);
    remember(alternate, observed);
    return result;
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
