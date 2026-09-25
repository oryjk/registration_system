import type { OnboardingIntent } from "@/utils/onboardingGuideStorage";

export type HomeEmptyHeroMode =
  | "guest"
  | "no-team-unknown"
  | "no-team-captain"
  | "no-team-player"
  | "team-manager"
  | "team-member";

export type HomeEmptyHeroAction =
  | "browse"
  | "create-team"
  | "create-match"
  | "create-pickup";

export interface HomeEmptyHeroState {
  mode: HomeEmptyHeroMode;
  actions: HomeEmptyHeroAction[];
}

export interface HomeEmptyHeroContext {
  isGuest: boolean;
  hasTeam: boolean;
  canManageTeam: boolean;
  creationAllowed: boolean;
  intent: OnboardingIntent | null;
}

export function resolveHomeEmptyHeroState(context: HomeEmptyHeroContext): HomeEmptyHeroState {
  if (context.isGuest) {
    return { mode: "guest", actions: ["browse"] };
  }

  if (context.hasTeam) {
    if (context.canManageTeam) {
      return {
        mode: "team-manager",
        actions: context.creationAllowed ? ["create-match", "browse"] : ["browse"],
      };
    }
    return { mode: "team-member", actions: ["browse"] };
  }

  if (!context.creationAllowed) {
    return {
      mode: context.intent === "captain"
        ? "no-team-captain"
        : context.intent === "player"
          ? "no-team-player"
          : "no-team-unknown",
      actions: ["browse"],
    };
  }

  if (context.intent === "captain") {
    return { mode: "no-team-captain", actions: ["create-team", "browse"] };
  }

  if (context.intent === "player") {
    return { mode: "no-team-player", actions: ["browse", "create-pickup", "create-team"] };
  }

  return { mode: "no-team-unknown", actions: ["create-team", "browse"] };
}
