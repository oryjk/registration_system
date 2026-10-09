import { getCurrentScope, onScopeDispose, shallowReactive } from "vue";
import { canCacheMinioImages, resolveMinioImage, retainMinioImage } from "@/utils/minioImageCache";
import { isMinioImageUrl } from "@/utils/minioImagePolicy";

/** Resolve native image src without replacing its element, sizing or events. */
export function useMinioImages(resolve = resolveMinioImage, retain = retainMinioImage) {
  const paths = shallowReactive<Record<string, string>>({});
  const releases: Array<() => void> = [];
  let disposed = false;
  if (getCurrentScope()) onScopeDispose(() => { disposed = true; for (const release of releases) release(); });
  function minioImageSrc(src: string | undefined | null): string {
    const url = src ?? "";
    if (!isMinioImageUrl(url) || !canCacheMinioImages()) return url;
    if (disposed) return paths[url] ?? url;
    if (!Object.prototype.hasOwnProperty.call(paths, url)) {
      releases.push(retain(url));
      // Empty src reserves the original native image geometry without a second download.
      paths[url] = "";
      void resolve(url).then(path => { if (!disposed) paths[url] = path; }, () => { if (!disposed) paths[url] = url; });
    }
    return paths[url] ?? "";
  }
  return { minioImageSrc };
}
