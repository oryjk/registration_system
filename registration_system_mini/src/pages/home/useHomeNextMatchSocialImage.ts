import { ref } from "vue";
import type { RuntimeConfigLoader } from "./homeRuntimeConfigCycle";

// 首页「下一场还没安排」空状态插画：URL 来自后台可配置的运行配置
// （mini_app_settings home 分区 → /system/mini-app-runtime-config）。
// 由首页注入当前加载周期的共享 loader：同一轮内与新手引导共用一次请求，
// 每轮首页加载重新 ensure，换图与失败重试随周期生效。
// 属于增强体验：拉取失败静默保持当前值，HomeEmptyHero 回退内置轻量视觉。
export function useHomeNextMatchSocialImage(options: { loadRuntimeConfig: RuntimeConfigLoader }) {
  const nextMatchSocialImageUrl = ref("");

  function ensureSocialImageLoaded(): void {
    void options.loadRuntimeConfig()
      .then((config) => {
        nextMatchSocialImageUrl.value = config.home.next_match_social_image_url;
      })
      .catch(() => {
        // 保持当前值：插画缺失不应影响首页主体。
      });
  }

  return { nextMatchSocialImageUrl, ensureSocialImageLoaded };
}
