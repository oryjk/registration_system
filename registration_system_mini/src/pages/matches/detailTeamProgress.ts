import type { AvatarItem } from "@/components/ui/avatarTypes";
import { byRegistrationTimeAsc } from "./detailState";
import type { AppMatchSummary } from "@/types/match";
import type { MatchTeamProgressItem } from "@/types/viewModels";
import { resolveInheritedGuestLimit } from "@/utils/matchCapacity";
import type { MatchTeamGroupSummary } from "./detailData";

export function buildMatchTeamProgress(
  match: AppMatchSummary | null,
  groups: MatchTeamGroupSummary[],
  selectedGroupId: string,
  joinedCount: number,
  selectedAvatars?: AvatarItem[],
): MatchTeamProgressItem[] {
  if (!match || match.publication_mode !== "online_team") return [];
  const hostGroup = groups.find((group) => group.kind === "host_team");
  return groups.map((group) => ({
    id: group.id,
    label: group.kind === "host_team"
      ? (group.teamId === match.host_team_id ? match.host_team_name : "主队")
      : (group.teamId === match.away_team_id && match.away_team_name ? match.away_team_name : "客队"),
    // 当前组与名单共用实时人数（含接口未展开的报名人数）；其他组保留接口计数。
    attending: group.id === selectedGroupId ? joinedCount : group.attendingCount,
    avatars: group.id === selectedGroupId && selectedAvatars
      ? selectedAvatars
      : [...(group.participants ?? [])]
        .filter((person) => person.status === "attending")
        .sort((a, b) => byRegistrationTimeAsc(
          { user_id: a.user_id, operation_time: a.registered_at },
          { user_id: b.user_id, operation_time: b.registered_at },
        ))
        .map((person) => ({
          id: person.user_id,
          name: (person.nickname || `用户 ${person.user_id}`) + ((person.registration_count ?? 1) > 1 ? `（${person.registration_count}人）` : ""),
          avatarUrl: person.avatar_url ?? "",
        })),
    // 客队上限未配置时继承主队（主客同制），规则与约队大厅列表共用。
    required: group.kind === "guest_team"
      ? resolveInheritedGuestLimit(hostGroup?.minPlayers ?? null, group.minPlayers)
      : group.minPlayers,
    max: group.kind === "guest_team"
      ? resolveInheritedGuestLimit(hostGroup?.maxPlayers ?? null, group.maxPlayers)
      : group.maxPlayers,
  }));
}
