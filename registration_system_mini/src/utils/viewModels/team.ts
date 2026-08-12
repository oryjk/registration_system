import type { BackendTeam, BackendTeamCreditTransaction, BackendTeamDetail } from "@/types/backend";
import type { TeamProfileViewModel } from "@/types/viewModels";
import { formatDateTimeLabel } from "./common";

function toRoleLabel(role: string): string {
  switch (role) {
    case "captain":
      return "队长";
    case "leader":
      return "领队";
    case "vice_captain":
      return "副队长";
    default:
      return "队员";
  }
}

export function formatCreditTransactionLabel(transaction: BackendTeamCreditTransaction): string {
  switch (transaction.transaction_type) {
    case "match_review":
      return `赛后互评 +${transaction.delta}`;
    case "membership_recharge":
      return `会员充值 +${transaction.delta}`;
    case "manual_penalty":
      return `信用罚扣 ${transaction.delta}`;
    default:
      return `信用变动 ${transaction.delta > 0 ? "+" : ""}${transaction.delta}`;
  }
}

export function buildTeamProfiles(
  currentUserId: number,
  teams: BackendTeam[],
  detailsByTeamId: Record<string, BackendTeamDetail>,
): TeamProfileViewModel[] {
  return teams.map((team) => {
    const detail = detailsByTeamId[team.id];
    const selfMember = detail?.members.find((member) => member.user_id === currentUserId);
    const myRole = selfMember?.role ?? team.my_role ?? (team.captain_id === currentUserId ? "captain" : "member");
    return {
      id: team.id,
      name: team.name,
      description: team.description ?? "",
      logoUrl: team.logo_url ?? "",
      status: team.status,
      memberCount: detail?.members.length ?? team.member_count ?? 0,
      myRole,
      myRoleLabel: toRoleLabel(myRole),
      joinedAt: selfMember?.joined_at ?? team.joined_at ?? "",
      isCaptain: myRole === "captain",
      canManageTeam: myRole === "captain" || myRole === "leader",
      creditScore: team.credit_score,
      trustLabel: team.trust_label,
      vipUntil: formatDateTimeLabel(team.vip_until),
      isVip: team.is_vip,
    };
  });
}
