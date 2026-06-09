export interface MatchPublishFormModel {
  name: string;
  location: string;
  locationLatitude: number | null;
  locationLongitude: number | null;
  holdingDate: number;
  matchEndTime: number;
  startTime: number;
  endTime: number;
  opposing: string;
  description: string;
  playersPerTeam: string | number;
  color: string;
  opposingColor: string;
  matchKind?: "external" | "internal";
  feePerPerson?: string | number;
  enableCheckIn?: boolean;
  checkInRadiusMeters?: string | number;
  openMinutesBefore?: string | number;
  closeMinutesAfter?: string | number;
}
