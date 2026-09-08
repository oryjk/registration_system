import { cancelMyMatchRegistration, putMyMatchRegistration } from "@/api/match";

export function submitMatchIndividualRegistration(
  matchId: string,
  groupId: string,
  status: "attending" | "leave",
  registrationCount = 1,
) {
  return putMyMatchRegistration(matchId, groupId, status, registrationCount);
}

export function cancelMatchIndividualRegistration(matchId: string, groupId: string) {
  return cancelMyMatchRegistration(matchId, groupId);
}
