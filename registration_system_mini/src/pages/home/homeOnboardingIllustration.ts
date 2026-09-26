import type { OnboardingIllustrations } from "@/composables/useOnboardingIllustrations";
import type { HomeEmptyHeroState } from "./homeEmptyHeroState";

/** 管理者正常约球沿用原宣传图，其余任务使用独立运营配置。 */
export function resolveHomeOnboardingIllustration(
  state: HomeEmptyHeroState,
  images: OnboardingIllustrations,
  socialImageUrl: string,
): string {
  switch (state.mode) {
    case "guest":
    case "no-team-unknown":
      return images.welcome;
    case "no-team-captain":
    case "no-team-member":
      return images.team;
    case "no-team-player":
    case "team-member":
      return images.match;
    case "team-manager":
      return state.actions[0] === "invite-team" ? images.team : socialImageUrl;
  }
}
