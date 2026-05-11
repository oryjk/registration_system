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

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function toBackendDateTime(timestamp: number) {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

