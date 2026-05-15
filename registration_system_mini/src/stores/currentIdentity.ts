import type { BackendUser } from "@/types/backend";
import type { CurrentIdentityViewModel, TeamProfileViewModel } from "@/types/viewModels";
import type { StoredCurrentIdentitySelection } from "@/utils/authStorage";

export function buildAvailableIdentities(
  currentUser: BackendUser | null,
  teamProfiles: TeamProfileViewModel[],
): CurrentIdentityViewModel[] {
  const teamIdentities = teamProfiles
    .filter((team) => team.canManageTeam)
    .map((team) => ({
      kind: "team" as const,
      id: `team:${team.id}`,
      teamId: team.id,
      label: team.name,
      roleLabel: team.myRoleLabel,
    }));

  if (!currentUser?.is_venue) {
    return teamIdentities;
  }

  return [
    ...teamIdentities,
    {
      kind: "venue" as const,
      id: "venue",
      label: currentUser.real_name || currentUser.nickname || "场馆身份",
      roleLabel: "场馆",
    },
  ];
}

export function resolveCurrentIdentitySelection(
  storedSelection: StoredCurrentIdentitySelection | null,
  availableIdentities: CurrentIdentityViewModel[],
  currentTeamId?: number | null,
): StoredCurrentIdentitySelection | null {
  if (!availableIdentities.length) {
    return null;
  }

  if (storedSelection) {
    const matchedStoredIdentity = availableIdentities.find((identity) =>
      identity.kind === storedSelection.kind &&
      (identity.kind === "venue" || identity.teamId === storedSelection.teamId),
    );
    if (matchedStoredIdentity) {
      return storedSelection;
    }
  }

  const matchedCurrentTeamIdentity = availableIdentities.find(
    (identity) => identity.kind === "team" && identity.teamId === currentTeamId,
  );
  const fallbackIdentity = matchedCurrentTeamIdentity ?? availableIdentities[0];

  return fallbackIdentity.kind === "team"
    ? { kind: "team", teamId: fallbackIdentity.teamId }
    : { kind: "venue" };
}

export function findCurrentIdentity(
  selection: StoredCurrentIdentitySelection | null,
  availableIdentities: CurrentIdentityViewModel[],
): CurrentIdentityViewModel | null {
  if (!selection) {
    return null;
  }

  return (
    availableIdentities.find((identity) =>
      identity.kind === selection.kind && (identity.kind === "venue" || identity.teamId === selection.teamId),
    ) ?? null
  );
}
