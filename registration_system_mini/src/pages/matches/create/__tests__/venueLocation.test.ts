import { describe, expect, test } from "bun:test";
import { openVenueLocation } from "../../../../utils/venueLocation";

type MapApi = NonNullable<Parameters<typeof openVenueLocation>[1]>;
const venue = { location: "球场", latitude: 30.6, longitude: 104.1, use_count: 1, last_used_at: "" };
function createApi() {
  const locations: Parameters<MapApi["openLocation"]>[0][] = [];
  const toasts: Parameters<MapApi["showToast"]>[0][] = [];
  return {
    locations, toasts,
    openLocation: (options: Parameters<MapApi["openLocation"]>[0]) => { locations.push(options); },
    showToast: (options: Parameters<MapApi["showToast"]>[0]) => { toasts.push(options); },
  };
}

describe("venue map preview", () => {
  test("opens the saved position without modifying the venue", () => {
    const api = createApi();
    const original = { ...venue };
    openVenueLocation(venue, api);
    const { fail, ...position } = api.locations[0]!;
    expect(position).toEqual({
      latitude: 30.6, longitude: 104.1, name: "球场", address: "球场",
    });
    expect(venue).toEqual(original);
    expect(api.toasts.length).toEqual(0);
  });

  test("does not open an invented position for missing or invalid coordinates", () => {
    for (const coordinates of [
      { latitude: null }, { longitude: undefined }, { latitude: NaN },
      { latitude: 91 }, { longitude: 181 },
    ]) {
      const api = createApi();
      openVenueLocation({ ...venue, ...coordinates }, api);
      expect(api.locations.length).toEqual(0);
      expect(api.toasts.length).toEqual(1);
    }
  });

  test("accepts zero coordinates", () => {
    const api = createApi();
    openVenueLocation({ ...venue, latitude: 0, longitude: 0 }, api);
    expect(api.locations.length).toEqual(1);
  });

  test("reports map failures", () => {
    const api = createApi();
    openVenueLocation(venue, api);
    api.locations[0]?.fail();
    expect(api.toasts.length).toEqual(1);
  });
});
