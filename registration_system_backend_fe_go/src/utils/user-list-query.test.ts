import { parseUserListQuery, serializeUserListQuery } from "./user-list-query";

describe("user list URL query", () => {
  it("applies stable defaults", () => {
    expect(parseUserListQuery("")).toEqual({
      page: 1,
      page_size: 20,
      match_admin_only: false,
      activity: "all",
      status: "all",
      identity: "all",
      sort: "last_active_desc",
    });
  });

  it("keeps supported activity filters and trims search text", () => {
    expect(
      parseUserListQuery(
        "?search=%20%E5%BC%A0%E4%B8%89%20&activity=inactive_30d&page=3&page_size=50",
      ),
    ).toEqual({
      page: 3,
      page_size: 50,
      match_admin_only: false,
      search: "张三",
      activity: "inactive_30d",
      status: "all",
      identity: "all",
      sort: "last_active_desc",
    });
  });

  it.each(["today", "ACTIVE_7D", "unknown"])(
    "drops an unsupported activity filter: %s",
    (activity) => {
      expect(parseUserListQuery(`?activity=${activity}`)).toEqual({
        page: 1,
        page_size: 20,
        match_admin_only: false,
        activity: "all",
        status: "all",
        identity: "all",
        sort: "last_active_desc",
      });
    },
  );

  it.each(["banned", "ACTIVE", "unknown"])(
    "drops an unsupported status filter: %s",
    (status) => {
      expect(parseUserListQuery(`?status=${status}`).status).toBe("all");
    },
  );

  it.each(["superuser", "MATCH_ADMIN", "unknown"])(
    "drops an unsupported identity filter: %s",
    (identity) => {
      expect(parseUserListQuery(`?identity=${identity}`).identity).toBe("all");
    },
  );

  it("keeps supported sort values and defaults to recent activity desc", () => {
    expect(parseUserListQuery("?sort=created_asc").sort).toBe("created_asc");
    expect(parseUserListQuery("?sort=nickname_asc").sort).toBe(
      "last_active_desc",
    );
  });

  it("preserves match-admin filter and serializes activity", () => {
    expect(
      serializeUserListQuery({
        page: 2,
        page_size: 50,
        search: "  李四  ",
        match_admin_only: true,
        activity: "active_7d",
      }),
    ).toBe(
      "?search=%E6%9D%8E%E5%9B%9B&match_admin_only=true&activity=active_7d&page=2&page_size=50",
    );

    expect(
      serializeUserListQuery({
        page: 1,
        page_size: 20,
        match_admin_only: false,
        activity: "all",
      }),
    ).toBe("");
  });

  it("serializes status, identity and non-default sort", () => {
    expect(
      serializeUserListQuery({
        status: "frozen",
        identity: "normal",
        sort: "created_asc",
      }),
    ).toBe("?status=frozen&identity=normal&sort=created_asc");

    // 默认值不进 URL，保持链接干净。
    expect(
      serializeUserListQuery({
        status: "all",
        identity: "all",
        sort: "last_active_desc",
      }),
    ).toBe("");
  });
});
