import { isMatchListQueryKey } from "./match-query-key";

describe("match query key classification", () => {
  it("matches list keys without matching detail keys", () => {
    expect(
      isMatchListQueryKey([
        "matches",
        { page: 1, page_size: 20, status: "ongoing" },
      ]),
    ).toBe(true);
    expect(isMatchListQueryKey(["matches", "match-id"])).toBe(false);
    expect(isMatchListQueryKey(["teams"])).toBe(false);
  });
});
