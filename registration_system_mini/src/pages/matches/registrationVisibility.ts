export interface TeamRegistrationVisibilityInput {
  currentTeamId?: string | null;
  canManageTeam?: boolean | null;
  sourceActivityId?: string | null;
  homeTeamId?: string | null;
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
