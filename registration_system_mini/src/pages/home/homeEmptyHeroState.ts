export type HomeEmptyHeroAudience = "guest" | "no-team" | "team";
export type HomeEmptyHeroSecondaryAction = "create-team" | "create-match" | null;

export interface HomeEmptyHeroState {
  audience: HomeEmptyHeroAudience;
  secondaryAction: HomeEmptyHeroSecondaryAction;
}

export interface HomeEmptyHeroContext {
  isGuest: boolean;
  hasTeam: boolean;
  canManageTeam: boolean;
  creationAllowed: boolean;
}

export function resolveHomeEmptyHeroState(context: HomeEmptyHeroContext): HomeEmptyHeroState {
  if (context.isGuest) {
    return { audience: "guest", secondaryAction: null };
  }
  if (!context.hasTeam) {
    return {
      audience: "no-team",
      secondaryAction: context.creationAllowed ? "create-team" : null,
    };
  }
  return {
    audience: "team",
    secondaryAction: context.creationAllowed && context.canManageTeam ? "create-match" : null,
  };
}
