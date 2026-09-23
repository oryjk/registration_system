import type { BackendVenueSuggestion } from "@/api/match";

export interface VenueMapPoint extends BackendVenueSuggestion {
  id: number;
  latitude: number;
  longitude: number;
}

export function toVenueMapPoints(venues: BackendVenueSuggestion[]): VenueMapPoint[] {
  return venues.filter((venue): venue is BackendVenueSuggestion & { latitude: number; longitude: number } =>
    !!venue.location.trim() && typeof venue.latitude === "number" && Number.isFinite(venue.latitude) && Math.abs(venue.latitude) <= 90 &&
    typeof venue.longitude === "number" && Number.isFinite(venue.longitude) && Math.abs(venue.longitude) <= 180,
  ).map((venue, index) => ({ ...venue, id: index + 1 }));
}

export function filterVenueMapPoints(venues: VenueMapPoint[], query: string) {
  const keyword = query.trim().toLocaleLowerCase();
  return venues.filter((venue) => venue.location.toLocaleLowerCase().includes(keyword));
}
