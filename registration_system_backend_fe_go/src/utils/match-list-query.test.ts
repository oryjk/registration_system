import {
  parseMatchListQuery,
  serializeMatchListQuery,
} from "./match-list-query";

describe("match list URL query", () => {
  it("applies stable pagination defaults", () => {
    expect(parseMatchListQuery("")).toEqual({
      page: 1,
      page_size: 20,
    });
  });

  it("keeps supported filters and trims search text", () => {
    expect(
      parseMatchListQuery(
        "?search=%20%E5%91%A8%E6%9C%AB%E8%B5%9B%20&status=ongoing&page=3&page_size=50",
      ),
    ).toEqual({
      page: 3,
      page_size: 50,
      search: "周末赛",
      status: "ongoing",
    });
  });

  it.each(["draft", "ONGOING", "unknown"])(
    "drops an unsupported status: %s",
    (status) => {
      expect(parseMatchListQuery(`?status=${status}`)).toEqual({
        page: 1,
        page_size: 20,
      });
    },
  );

  it.each([
    ["?page=0&page_size=-5", 1, 20],
    ["?page=2.5&page_size=abc", 1, 20],
    ["?page=&page_size=0", 1, 20],
  ])("falls back for invalid pagination in %s", (search, page, pageSize) => {
    expect(parseMatchListQuery(search)).toEqual({
      page,
      page_size: pageSize,
    });
  });

  it("omits defaults and serializes normalized values in stable order", () => {
    expect(
      serializeMatchListQuery({
        page: 2,
        page_size: 50,
        search: "  周末赛  ",
        status: "registering",
      }),
    ).toBe(
      "?search=%E5%91%A8%E6%9C%AB%E8%B5%9B&status=registering&page=2&page_size=50",
    );

    expect(serializeMatchListQuery({ page: 1, page_size: 20 })).toBe("");
  });
});
