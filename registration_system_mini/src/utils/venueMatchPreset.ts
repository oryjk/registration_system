export interface VenueMatchPreset {
  location: string;
  locationLatitude: number;
  locationLongitude: number;
}

export function buildVenueMatchCreateUrl(venue: { location: string; latitude: number; longitude: number }) {
  return `/pages/matches/create/index?venue=${encodeURIComponent(JSON.stringify(venue))}`;
}

/** 兼容小程序原始 query 与 H5 已解码 query；编辑页不接受创建预填参数。 */
export function readVenueMatchPreset(query?: Record<string, unknown>): VenueMatchPreset | null {
  if (query?.editId || typeof query?.venue !== "string") return null;
  try {
    let data: unknown;
    try { data = JSON.parse(query.venue); }
    catch { data = JSON.parse(decodeURIComponent(query.venue)); }
    if (!data || typeof data !== "object") return null;
    const venue = data as Record<string, unknown>;
    if (typeof venue.location !== "string" || !venue.location.trim() ||
      typeof venue.latitude !== "number" || !Number.isFinite(venue.latitude) || Math.abs(venue.latitude) > 90 ||
      typeof venue.longitude !== "number" || !Number.isFinite(venue.longitude) || Math.abs(venue.longitude) > 180) return null;
    return { location: venue.location.trim(), locationLatitude: venue.latitude, locationLongitude: venue.longitude };
  } catch { return null; }
}
