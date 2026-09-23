import type { BackendVenueSuggestion } from "@/api/match";

export interface VenueHistoryItem {
  location: string;
  latitude: number | null;
  longitude: number | null;
}

const STORAGE_PREFIX = "registration_system_mini_pickup_venues_v1_";
const MAX_VENUES = 5;

function storageKey(userId: number | null): string | null {
  return userId && Number.isInteger(userId) && userId > 0 ? `${STORAGE_PREFIX}${userId}` : null;
}

function normalizedName(location: string): string {
  return location.trim().toLocaleLowerCase();
}

function toHistoryItem(value: unknown): VenueHistoryItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<VenueHistoryItem>;
  if (typeof item.location !== "string" || !item.location.trim()) return null;
  return {
    location: item.location.trim(),
    latitude: typeof item.latitude === "number" && Number.isFinite(item.latitude) ? item.latitude : null,
    longitude: typeof item.longitude === "number" && Number.isFinite(item.longitude) ? item.longitude : null,
  };
}

export function readVenueHistory(userId: number | null): VenueHistoryItem[] {
  const key = storageKey(userId);
  if (!key) return [];
  try {
    const stored = uni.getStorageSync(key);
    return Array.isArray(stored) ? stored.map(toHistoryItem).filter((item): item is VenueHistoryItem => !!item).slice(0, MAX_VENUES) : [];
  } catch {
    return [];
  }
}

export function rememberVenue(userId: number | null, venue: VenueHistoryItem): void {
  const key = storageKey(userId);
  const item = toHistoryItem(venue);
  if (!key || !item) return;
  const history = readVenueHistory(userId).filter((stored) => normalizedName(stored.location) !== normalizedName(item.location));
  try {
    uni.setStorageSync(key, [item, ...history].slice(0, MAX_VENUES));
  } catch {
    // 本地历史不可用时不影响比赛发布。
  }
}

export function mergeVenueHistory(local: VenueHistoryItem[], suggested: BackendVenueSuggestion[]): VenueHistoryItem[] {
  const recentSuggestions = [...suggested].sort((a, b) => Date.parse(b.last_used_at) - Date.parse(a.last_used_at));
  const merged: VenueHistoryItem[] = [];
  for (const value of [...local, ...recentSuggestions]) {
    const item = toHistoryItem(value);
    if (!item) continue;
    const existing = merged.find((venue) => normalizedName(venue.location) === normalizedName(item.location));
    if (existing) {
      if (existing.latitude === null && item.latitude !== null) existing.latitude = item.latitude;
      if (existing.longitude === null && item.longitude !== null) existing.longitude = item.longitude;
      continue;
    }
    if (merged.length < MAX_VENUES) merged.push(item);
  }
  return merged;
}
