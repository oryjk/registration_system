export interface TeamRegistrationVisibilityInput {
  currentTeamId?: number | null;
  canManageTeam?: boolean | null;
  sourceActivityId?: string | null;
  homeTeamId?: number | null;
}

export function canShowTeamRegistrationTab(input: TeamRegistrationVisibilityInput): boolean {
  if (!input.canManageTeam) {
    return false;
  }
  if (input.sourceActivityId) {
    return false;
  }
  return input.currentTeamId !== input.homeTeamId;
}
