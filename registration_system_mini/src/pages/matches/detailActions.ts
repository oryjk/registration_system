import {
  cancelTeamRegistration,
  submitActivityCheckIn,
  submitTeamRegistration,
  updateTeamCheckInConfig,
  updateMyStand,
} from "@/api/activity";
import { settleActivityExpense, type SettleActivityExpensePayload } from "@/api/billing";
import { cancelMyMatchRegistration, putMyMatchRegistration } from "@/api/match";
import { submitTeamActivityReview } from "@/api/team";

export function submitIndividualRegistration(activityId: string) {
  return updateMyStand(activityId, {
    stand: 1,
    registration_count: 1,
  });
}

export function cancelIndividualRegistration(activityId: string) {
  return updateMyStand(activityId, {
    stand: 0,
    registration_count: 0,
  });
}

export function submitIndividualLeave(activityId: string) {
  return updateMyStand(activityId, {
    stand: 2,
    registration_count: 0,
  });
}

export function submitMatchIndividualRegistration(matchId: string, groupId: string, status: "attending" | "leave") {
  return putMyMatchRegistration(matchId, groupId, status);
}

export function cancelMatchIndividualRegistration(matchId: string, groupId: string) {
  return cancelMyMatchRegistration(matchId, groupId);
}

export function submitTeamRegistrationForMatch(activityId: string, teamId: number, registrationCount: number) {
  return submitTeamRegistration(activityId, {
    team_id: teamId,
    registration_count: registrationCount,
  });
}

export function cancelTeamRegistrationForMatch(activityId: string, teamId: number) {
  return cancelTeamRegistration(activityId, {
    team_id: teamId,
  });
}

export function submitMatchCheckIn(params: {
  activityId: string;
  teamId: number;
  latitude: number;
  longitude: number;
}) {
  return submitActivityCheckIn(params.activityId, {
    team_id: params.teamId,
    latitude: params.latitude,
    longitude: params.longitude,
  });
}

export function saveMatchCheckInConfig(params: {
  activityId: string;
  teamId: number;
  enabled: boolean;
  radiusMeters: number;
  openMinutesBefore: number;
  closeMinutesAfter: number;
}) {
  return updateTeamCheckInConfig(params.activityId, {
    team_id: params.teamId,
    enabled: params.enabled,
    radius_meters: params.radiusMeters,
    open_minutes_before: params.openMinutesBefore,
    close_minutes_after: params.closeMinutesAfter,
  });
}

export function submitMatchActivityReview(params: {
  teamId: number;
  activityId: string;
  rating: number;
  comment?: string;
}) {
  return submitTeamActivityReview(params.teamId, {
    activity_id: params.activityId,
    reviewer_team_id: params.teamId,
    rating: params.rating,
    comment: params.comment,
  });
}

export function submitMatchSettlement(activityId: string, payload: SettleActivityExpensePayload) {
  return settleActivityExpense(activityId, payload);
}
