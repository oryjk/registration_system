import { describe, expect, test } from "bun:test";
import { filterVenueMapPoints, toVenueMapPoints } from "../venueMapState";
const venue = { location: "体育公园", latitude: 30.6, longitude: 104.1, use_count: 1, last_used_at: "" };

describe("venue map data", () => {
  test("keeps every saved venue beyond the suggestion limit", () => {
    const points = toVenueMapPoints(Array.from({ length: 25 }, (_, index) => ({ ...venue, location: `球场${index}` })));
    expect(points.length).toEqual(25);
    expect(new Set(points.map(point => point.id)).size).toEqual(25);
  });
  test("does not plot missing or invalid coordinates", () => {
    const points = toVenueMapPoints([venue, { ...venue, latitude: null }, { ...venue, longitude: NaN }, { ...venue, latitude: 100 }, { ...venue, location: " " }]);
    expect(points.map(point => point.location)).toEqual(["体育公园"]);
  });
  test("search retains marker identities and clearing restores all venues", () => {
    const points = toVenueMapPoints([venue, { ...venue, location: "ABC球场" }]);
    expect(filterVenueMapPoints(points, " abc ").map(point => point.id)).toEqual([2]);
    expect(filterVenueMapPoints(points, "不存在")).toEqual([]);
    expect(filterVenueMapPoints(points, "")).toEqual(points);
  });
});
