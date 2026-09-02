import type { AppMatchPublicationMode } from "@/types/match";

export interface MatchPublishFormModel {
  name: string;
  location: string;
  locationLatitude: number | null;
  locationLongitude: number | null;
  holdingDate: number;
  matchEndTime: number;
  opposing: string;
  description: string;
  playersPerTeam: string | number;
  /** 主队报名人数上限；空表示未填，提交时回退为人制 + 2 的默认值。 */
  hostCapacityLimit: string | number;
  color: string;
  opposingColor: string;
  publicationMode: AppMatchPublicationMode;
  activityMatchKind?: "external" | "internal";
  feePerPerson?: string | number;
  enableCheckIn?: boolean;
  checkInRadiusMeters?: string | number;
  openMinutesBefore?: string | number;
  closeMinutesAfter?: string | number;
}
