import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  type AdminConsumeTeamFundPayload,
  type AdminCreditTeamFundPayload,
  type AdminReverseTeamFundPayload,
  adminConsumeTeamFund,
  adminCreditTeamFund,
  adminReverseTeamFund,
  listMemberTeamFundTransactions,
} from "../../api/teamFund";
import { queryKeys } from "./keys";

/** 手动充值队费后刷新对应球队的成员列表（余额列）。 */
export function useAdminCreditTeamFundMutation(teamID: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AdminCreditTeamFundPayload) =>
      adminCreditTeamFund(payload),
    onSuccess: (_result, variables) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.teamMembers(variables.team_id || teamID || 0),
      }),
  });
}

/** 消费扣费后同样刷新成员列表余额列。 */
export function useAdminConsumeTeamFundMutation(teamID: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AdminConsumeTeamFundPayload) =>
      adminConsumeTeamFund(payload),
    onSuccess: (_result, variables) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.teamMembers(variables.team_id || teamID || 0),
      }),
  });
}

/** 冲正后刷新成员列表与该成员的流水列表。 */
export function useAdminReverseTeamFundMutation(teamID: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AdminReverseTeamFundPayload) =>
      adminReverseTeamFund(payload),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.teamMembers(variables.team_id || teamID || 0),
      });
      void queryClient.invalidateQueries({
        queryKey: queryKeys.memberFundTransactions(
          variables.team_id,
          variables.user_id,
        ),
      });
    },
  });
}

/** 指定成员的队费流水（冲正需定位原流水 ID）。 */
export function useMemberFundTransactionsQuery(
  teamID: number | null,
  userID: number | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: queryKeys.memberFundTransactions(teamID || 0, userID || 0),
    queryFn: () =>
      listMemberTeamFundTransactions(teamID || 0, userID || 0, 0, 50),
    enabled: enabled && !!teamID && !!userID,
  });
}
