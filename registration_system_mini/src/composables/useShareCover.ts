import { getCurrentScope, onScopeDispose, ref } from "vue";
import { sanitizeMiniAppRuntimeConfig, type MiniAppRuntimeConfig } from "@/config/runtimeConfig";
import { getMiniAppRuntimeConfig } from "@/api/system";
import { DEFAULT_SHARE_COVERS, resolveShareCover, type ShareCoverScene } from "@/utils/share";
import { resolveMinioImage, retainMinioImage } from "@/utils/minioImageCache";

/** 页面展示时预取，分享时同步读取；配置未就绪也不会用敏感页面截图做封面。 */
export function useShareCover(scene: ShareCoverScene, loadConfig: () => Promise<MiniAppRuntimeConfig> = async () => sanitizeMiniAppRuntimeConfig(await getMiniAppRuntimeConfig()), loadImage = resolveMinioImage, retain = retainMinioImage) {
  const shareCoverUrl = ref(DEFAULT_SHARE_COVERS[scene]);
  const shareImageUrl = ref(DEFAULT_SHARE_COVERS[scene]);
  let generation = 0;
  let leasedUrl = "", disposed = false;
  let releaseImage = () => {};
  const scoped = !!getCurrentScope();
  if (scoped) onScopeDispose(() => { disposed = true; generation++; releaseImage(); });
  async function refreshShareCover(): Promise<void> {
    if (disposed) return;
    const version = ++generation;
    try {
      const config = await loadConfig();
      if (version === generation) shareCoverUrl.value = resolveShareCover(scene, config.home);
    } catch {
      // 图片配置失败不打扰页面；保留默认或上一次有效封面。
    }
    if (version !== generation) return;
    const url = shareCoverUrl.value;
    if (scoped && leasedUrl !== url) {
      releaseImage(); leasedUrl = url; releaseImage = retain(url);
    }
    shareImageUrl.value = url;
    try {
      const path = await loadImage(url);
      if (version === generation && url === shareCoverUrl.value) shareImageUrl.value = path;
    } catch { /* Keep a valid synchronous remote fallback. */ }
  }
  return { shareCoverUrl, shareImageUrl, refreshShareCover };
}
