import type { BackendVenueSuggestion } from "@/api/match";

interface VenueMapApi {
  openLocation(options: {
    latitude: number;
    longitude: number;
    name: string;
    address: string;
    fail: () => void;
  }): void;
  showToast(options: { title: string; icon: "none" }): void;
}

export function openVenueLocation(venue: BackendVenueSuggestion, api: VenueMapApi = uni) {
  const { latitude, longitude } = venue;
  if (
    typeof latitude !== "number" || !Number.isFinite(latitude) || Math.abs(latitude) > 90 ||
    typeof longitude !== "number" || !Number.isFinite(longitude) || Math.abs(longitude) > 180
  ) {
    api.showToast({ title: "该场地暂无坐标，请用地图选择地点", icon: "none" });
    return;
  }
  api.openLocation({
    latitude,
    longitude,
    name: venue.location,
    address: venue.location,
    fail() {
      api.showToast({ title: "地图打开失败，请在手机端重试", icon: "none" });
    },
  });
}
