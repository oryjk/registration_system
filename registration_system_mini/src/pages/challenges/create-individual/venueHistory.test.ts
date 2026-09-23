import { describe, expect, test } from "bun:test";
import { mergeVenueHistory, readVenueHistory, rememberVenue } from "./venueHistory";

const storage = new Map<string, unknown>();
(globalThis as typeof globalThis & { uni: UniApp.Uni }).uni = {
  getStorageSync: (key: string) => storage.get(key),
  setStorageSync: (key: string, value: unknown) => { storage.set(key, value); },
} as UniApp.Uni;

describe("散人约球场地历史", () => {
  test("成功发布后按用户保存最近场地，同名重选移到最前面", () => {
    storage.clear();
    for (const location of ["一号球场", "二号球场", "三号球场", "四号球场", "五号球场", "六号球场"]) {
      rememberVenue(1, { location, latitude: null, longitude: null });
    }
    rememberVenue(1, { location: " 三号球场 ", latitude: 31.2, longitude: 121.4 });
    rememberVenue(2, { location: "另一用户的球场", latitude: null, longitude: null });

    expect(readVenueHistory(1).map((venue) => venue.location)).toEqual(["三号球场", "六号球场", "五号球场", "四号球场", "二号球场"]);
    expect(readVenueHistory(1)[0]).toEqual({ location: "三号球场", latitude: 31.2, longitude: 121.4 });
    expect(readVenueHistory(2).map((venue) => venue.location)).toEqual(["另一用户的球场"]);
    expect(readVenueHistory(null)).toEqual([]);
  });

  test("本地最近场地排在建议前，重复建议补全地图坐标", () => {
    storage.clear();
    const venues = mergeVenueHistory(
      [{ location: "一号球场", latitude: null, longitude: null }],
      [
        { location: "较早球场", latitude: null, longitude: null, use_count: 10, last_used_at: "2026-09-20T12:00:00Z" },
        { location: "一号球场", latitude: 31, longitude: 121, use_count: 1, last_used_at: "2026-09-21T12:00:00Z" },
        { location: "较新球场", latitude: 32, longitude: 122, use_count: 1, last_used_at: "2026-09-22T12:00:00Z" },
      ],
    );

    expect(venues.map((venue) => venue.location)).toEqual(["一号球场", "较新球场", "较早球场"]);
    expect(venues[0]).toEqual({ location: "一号球场", latitude: 31, longitude: 121 });
  });
});
