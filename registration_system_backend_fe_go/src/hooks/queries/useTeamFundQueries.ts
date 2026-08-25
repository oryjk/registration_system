import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type AdminCreditTeamFundPayload,
  adminCreditTeamFund,
} from "../../api/teamFund";
import { queryKeys } from "./keys";

/** 手动充值队费后刷新对应球队的成员列表（余额列）。 */
export function useAdminCreditTeamFundMutation(teamID: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: AdminCreditTeamFundPayload) =>
      adminCreditTeamFund(payload),
    onSuccess: (_result, variables) => {
      return queryClient.invalidateQueries({
        queryKey: queryKeys.teamMembers(variables.team_id || teamID || 0),
      });
    },
  });
}
