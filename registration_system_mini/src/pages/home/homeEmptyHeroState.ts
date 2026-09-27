import type { OnboardingIntent } from "@/utils/onboardingGuideStorage";

export type HomeEmptyHeroMode =
  | "guest"
  | "no-team-unknown"
  | "no-team-captain"
  | "no-team-member"
  | "no-team-player"
  | "team-manager"
  | "team-member";

export type HomeEmptyHeroAction =
  | "browse"
  | "create-team"
  | "join-team"
  | "invite-team"
  | "view-team"
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
  memberCount?: number;
}

export function resolveHomeEmptyHeroState(context: HomeEmptyHeroContext): HomeEmptyHeroState {
  if (context.isGuest) {
    return { mode: "guest", actions: context.creationAllowed
      ? ["create-team", "join-team", "browse"] : ["join-team", "browse"] };
  }

  if (context.hasTeam) {
    if (context.canManageTeam) {
      return {
        mode: "team-manager",
        actions: !context.creationAllowed ? ["invite-team", "browse"]
          : context.memberCount === 1 ? ["invite-team", "create-match", "browse"]
            : ["create-match", "invite-team", "browse"],
      };
    }
    return { mode: "team-member", actions: ["browse", "view-team"] };
  }

  if (!context.creationAllowed) {
    return {
      mode: "no-team-unknown",
      actions: ["join-team", "browse"],
    };
  }

  if (context.intent === "captain") {
    return { mode: "no-team-captain", actions: ["create-team", "join-team"] };
  }

  if (context.intent === "member") {
    return { mode: "no-team-member", actions: ["join-team", "browse"] };
  }

  if (context.intent === "player") {
    return { mode: "no-team-player", actions: ["browse", "create-pickup"] };
  }

  return { mode: "no-team-unknown", actions: ["create-team", "join-team", "browse"] };
}
