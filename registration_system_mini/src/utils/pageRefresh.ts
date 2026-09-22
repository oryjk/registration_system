/** One in-flight refresh per page; always release the native refresh indicator. */
export function createPageRefresh(
  load: () => unknown | Promise<unknown>,
  finish: () => void,
  reportError: (error: unknown) => void,
) {
  let pending: Promise<void> | null = null;
  return () => {
    if (pending) return pending;
    pending = Promise.resolve().then(load).then(() => {}, reportError).finally(() => {
      pending = null;
      finish();
    });
    return pending;
  };
}
