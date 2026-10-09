import { HONOR_BACKGROUNDS } from "@/config/honorBackgrounds";
import { createMinioImageCache, resolveMinioImage } from "./minioImageCache";

const backgroundUrls = new Set(HONOR_BACKGROUNDS.flatMap(item => [item.imageUrl, item.thumbnailUrl]));
/** Compatibility facade; all native callers now share the general MinIO cache. */
export function createHonorBackgroundCache() {
  const cache = createMinioImageCache();
  return { get: (url: string) => backgroundUrls.has(url) ? cache.get(url) : Promise.resolve(url) };
}
export const resolveHonorBackgroundImage = resolveMinioImage;
