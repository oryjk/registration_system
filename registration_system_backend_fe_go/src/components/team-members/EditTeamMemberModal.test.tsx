import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import type { TeamMember } from "@/types/team";
import { EditTeamMemberModal } from "./EditTeamMemberModal";

const member: TeamMember = {
  id: 1,
  user_id: 117,
  nickname: "ChengDu028",
  avatar_url: null,
  real_name: null,
  phone_number: null,
  role: "member",
  status: "left",
  joined_at: "2026-08-31T00:00:00Z",
  is_paid_member: false,
  balance_cents: 0,
  last_recharge_at: null,
};

describe("editing a member who left", () => {
  let root: Root;
  let container: HTMLDivElement;
  const onSubmit = vi.fn();

  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
  });
  afterAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
    vi.unstubAllGlobals();
  });
  beforeEach(async () => {
    onSubmit.mockClear();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    await act(async () => {
      root.render(
        <EditTeamMemberModal
          error=""
          member={member}
          onClose={() => {}}
          onSubmit={onSubmit}
          submitting={false}
        />,
      );
    });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  async function save() {
    const form = document.querySelector("form");
    if (!form) throw new Error("member edit form missing");
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true }),
      );
    });
  }

  it("preserves the left status when saving profile information", async () => {
    await save();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ status: "left" }),
    );
  });

  it("reactivates only after explicitly choosing enable", async () => {
    const enable = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent === "启用",
    );
    if (!enable) throw new Error("enable action missing");
    await act(async () => enable.click());
    await save();
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active" }),
    );
  });
});
