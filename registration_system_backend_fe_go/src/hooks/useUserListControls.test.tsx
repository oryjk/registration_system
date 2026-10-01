import { act } from "react";
import { createRoot } from "react-dom/client";
import { createMemoryRouter, RouterProvider } from "react-router";
import { useUserListControls } from "./useUserListControls";

async function mountControls(url: string) {
  const root = createRoot(document.createElement("div"));
  let controls: ReturnType<typeof useUserListControls> | undefined;
  function Harness() {
    controls = useUserListControls();
    return null;
  }
  const router = createMemoryRouter(
    [{ path: "/users", element: <Harness /> }],
    { initialEntries: [url] },
  );
  await act(async () => root.render(<RouterProvider router={router} />));
  return {
    get controls() {
      if (!controls) throw new Error("controls did not mount");
      return controls;
    },
    router,
    unmount: async () => {
      await act(async () => root.unmount());
      router.dispose();
    },
  };
}

describe("user directory controls", () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });
  afterAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
  });

  it("submits a trimmed draft and returns to page one while keeping filters", async () => {
    const view = await mountControls(
      "/users?page=3&status=frozen&page_size=50",
    );
    try {
      await act(async () => view.controls.setSearchDraft("  张三  "));
      expect(view.controls.query.search).toBeUndefined();
      await act(async () => view.controls.submitSearch());
      expect(view.controls.query).toMatchObject({
        search: "张三",
        page: 1,
        status: "frozen",
        page_size: 50,
      });
      expect(view.controls.searchDraft).toBe("张三");
    } finally {
      await view.unmount();
    }
  });

  it("clears filters and draft without changing sort or page size", async () => {
    const view = await mountControls(
      "/users?search=张三&activity=never&status=frozen&identity=normal&sort=created_asc&page=4&page_size=100",
    );
    try {
      await act(async () => view.controls.resetFilters());
      expect(view.controls.query).toMatchObject({
        page: 1,
        page_size: 100,
        sort: "created_asc",
        activity: "all",
        status: "all",
        identity: "all",
        match_admin_only: false,
      });
      expect(view.controls.query.search).toBeUndefined();
      expect(view.controls.searchDraft).toBe("");
      expect(view.controls.hasFilters).toBe(false);
    } finally {
      await view.unmount();
    }
  });

  it("restores search drafts from browser history and separates unsubmitted filters", async () => {
    const view = await mountControls("/users");
    try {
      await act(async () => view.controls.setSearchDraft("草稿"));
      expect(view.controls.hasFilters).toBe(true);
      expect(view.controls.hasAppliedFilters).toBe(false);
      await act(async () => view.router.navigate("/users?search=李四"));
      expect(view.controls.searchDraft).toBe("李四");
      await act(async () => view.router.navigate(-1));
      expect(view.controls.searchDraft).toBe("");
      expect(view.controls.hasFilters).toBe(false);
    } finally {
      await view.unmount();
    }
  });

  it("switches sorting direction, resets the page and keeps identity filters", async () => {
    const view = await mountControls("/users?identity=match_admin&page=2");
    try {
      expect(view.controls.sortDirection("last_active")).toBe("desc");
      await act(async () => view.controls.toggleSort("last_active"));
      expect(view.controls.query).toMatchObject({
        page: 1,
        sort: "last_active_asc",
        identity: "match_admin",
      });
      await act(async () => view.controls.toggleSort("created"));
      expect(view.controls.sortDirection("last_active")).toBeNull();
      expect(view.controls.sortDirection("created")).toBe("desc");
      await act(async () => view.controls.toggleSort("created"));
      expect(view.controls.sortDirection("created")).toBe("asc");
    } finally {
      await view.unmount();
    }
  });
});
