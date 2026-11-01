import { HOME_MATCH_THUMBNAIL_POOL } from "@/config/homeVisualAssets";
import { DEFAULT_MATCH_COVER_URL } from "@/config/matchCover";

/** 稳定伪随机分配：同一比赛在不同报名组、刷新或重排时仍使用同一张图。 */
function defaultThumbnail(id: string): string {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619) >>> 0;
  return HOME_MATCH_THUMBNAIL_POOL[hash % HOME_MATCH_THUMBNAIL_POOL.length] ?? DEFAULT_MATCH_COVER_URL;
}

export function resolveHomeMatchThumbnail(
  match: { id: string; coverImageUrl?: string },
  failedUrls: readonly string[] = [],
): string {
  const candidates = [match.coverImageUrl?.trim(), defaultThumbnail(match.id), DEFAULT_MATCH_COVER_URL];
  return candidates.find(url => !!url && !failedUrls.includes(url)) ?? "";
}
