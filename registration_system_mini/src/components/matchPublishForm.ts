export interface MatchPublishFormModel {
  name: string;
  location: string;
  locationLatitude: number | null;
  locationLongitude: number | null;
  holdingDate: number;
  startTime: number;
  endTime: number;
  opposing: string;
  description: string;
  playersPerTeam: string | number;
  feePerPerson?: string | number;
  enableCheckIn?: boolean;
  checkInRadiusMeters?: string | number;
  openMinutesBefore?: string | number;
  closeMinutesAfter?: string | number;
}
