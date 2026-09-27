import { ref } from "vue";
import { sanitizeMiniAppRuntimeConfig, type MiniAppRuntimeConfig } from "@/config/runtimeConfig";
import { getMiniAppRuntimeConfig } from "@/api/system";
import { DEFAULT_SHARE_COVERS, resolveShareCover, type ShareCoverScene } from "@/utils/share";

/** 页面展示时预取，分享时同步读取；配置未就绪也不会用敏感页面截图做封面。 */
export function useShareCover(scene: ShareCoverScene, loadConfig: () => Promise<MiniAppRuntimeConfig> = async () => sanitizeMiniAppRuntimeConfig(await getMiniAppRuntimeConfig())) {
  const shareCoverUrl = ref(DEFAULT_SHARE_COVERS[scene]);
  let generation = 0;
  async function refreshShareCover(): Promise<void> {
    const version = ++generation;
    try {
      const config = await loadConfig();
      if (version === generation) shareCoverUrl.value = resolveShareCover(scene, config.home);
    } catch {
      // 图片配置失败不打扰页面；保留默认或上一次有效封面。
    }
  }
  return { shareCoverUrl, refreshShareCover };
}
