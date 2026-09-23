import { describe, expect, test } from "bun:test";
import { buildVenueMatchCreateUrl, readVenueMatchPreset } from "../venueMatchPreset";
const venue = { location: "体育公园 A&B + 50% #1", latitude: 30.6, longitude: 104.1 };
const expected = { location: venue.location, locationLatitude: 30.6, locationLongitude: 104.1 };
describe("venue match creation preset", () => {
  test("preserves names and coordinates through navigation encoding", () => {
    const encoded = buildVenueMatchCreateUrl(venue).split("?venue=")[1]!;
    expect(readVenueMatchPreset({ venue: encoded })).toEqual(expected);
    expect(readVenueMatchPreset({ venue: decodeURIComponent(encoded) })).toEqual(expected);
  });
  test("never overrides an edited match", () => {
    expect(readVenueMatchPreset({ editId: "existing", venue: JSON.stringify(venue) })).toEqual(null);
  });
  test("ignores absent, malformed and invalid coordinates", () => {
    for (const query of [undefined, {}, { venue: "%not-json" }, { venue: "null" }, { venue: JSON.stringify({ ...venue, latitude: 91 }) }, { venue: JSON.stringify({ ...venue, longitude: null }) }]) {
      expect(readVenueMatchPreset(query)).toEqual(null);
    }
  });
});
