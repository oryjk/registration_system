import { ref } from "vue";
import { loadMiniAppRuntimeConfig, type MiniAppRuntimeConfig } from "@/config/runtimeConfig";

export interface OnboardingIllustrations {
  welcome: string;
  team: string;
  match: string;
}

/** 仅加载运营素材；失败不阻断主流程，旧请求不覆盖新配置。 */
export function useOnboardingIllustrations(loadConfig: () => Promise<MiniAppRuntimeConfig> = loadMiniAppRuntimeConfig) {
  const illustrations = ref<OnboardingIllustrations>({ welcome: "", team: "", match: "" });
  const illustrationRevision = ref(0);
  let generation = 0;

  async function refreshIllustrations(): Promise<void> {
    const version = ++generation;
    try {
      const { home } = await loadConfig();
      if (version !== generation) return;
      illustrations.value = {
        welcome: home.onboarding_welcome_image_url || "",
        team: home.onboarding_team_image_url || "",
        match: home.onboarding_match_image_url || "",
      };
      illustrationRevision.value += 1;
    } catch {
      // 下次进入/刷新页面可重试，当前页面保留最后一次成功配置。
    }
  }

  return { illustrations, illustrationRevision, refreshIllustrations };
}
