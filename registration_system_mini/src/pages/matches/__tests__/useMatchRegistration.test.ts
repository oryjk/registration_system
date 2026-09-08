import { computed, ref } from "vue";
import type { BackendActivity, BackendUser } from "@/types/backend";
import type { RegistrationWindowState } from "@/utils/registrationWindow";

const { describe, test, expect, mock, afterAll }: any = await import("bun:test");
const requests: Array<{ url: string; method: string; data?: unknown }> = [];
let requestFails = false;
mock.module("@/utils/request", () => ({
  requestApi: async (options: { url: string; method: string; data?: unknown }) => {
    requests.push(options);
    if (requestFails) throw new Error("报名人数已满");
    return {};
  },
}));
const { useMatchRegistration } = await import("../useMatchRegistration");
const previousUni = (globalThis as any).uni;
afterAll(() => { (globalThis as any).uni = previousUni; });

function setup(options: { groupId?: string; closed?: boolean; paid?: boolean } = {}) {
  requests.length = 0;
  requestFails = false;
  const notices: string[] = [];
  const events: string[] = [];
  (globalThis as any).uni = {
    showToast: ({ title }: { title: string }) => notices.push(title),
    showLoading: () => {},
    hideLoading: () => {},
    $emit: (event: string) => events.push(event),
  };
  const state = {
    match: ref({ id: "f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003", name: "周末比赛" } as BackendActivity),
    registrations: ref([]),
    currentStatus: ref(options.paid ? "参加" : "待定"),
    currentUser: ref({ id: 7 } as BackendUser),
    submittingStatus: ref(false),
    isGuestMode: ref(false),
    registrationGroupId: ref(options.groupId ?? "a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003"),
    needsTeamToRegister: computed(() => false),
    openJoinTeamSheet: () => {},
    canSubmitIndividualRegistration: computed(() => true),
    registrationWindowState: computed<RegistrationWindowState>(() => options.closed ? "closed" : "open"),
    ensureSessionReady: async () => {},
    handleGuestLogin: async () => {},
    confirmRegistrationAction: async () => true,
    requiresPrepaidPayment: computed(() => false),
    payRegistrationFee: async () => true,
    isPickupMatch: computed(() => !!options.paid),
    myRegistrationPaid: ref(!!options.paid),
    openSignupSheet: () => {},
    closeSignupSheet: () => {},
  };
  return { ...useMatchRegistration(state), state, notices, events };
}

describe("Go match registration after legacy removal", () => {
  for (const [stand, status, method] of [[1, "attending", "PUT"], [2, "leave", "PUT"], [0, null, "DELETE"]] as const) {
    test(`submits stand ${stand} through the Go registration group`, async () => {
      const page = setup();
      await page.handleSelectTeamMemberStand(stand);
      expect(requests).toEqual([{
        url: "/matches/f7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003/groups/a7d4b0e1-9b8f-4d07-a5d3-9f0cb3f7c003/my-registration",
        method,
        ...(status ? { data: { status, registration_count: 1 } } : {}),
        auth: true,
      }]);
      expect(page.state.submittingStatus.value).toEqual(false);
      expect(page.events).toEqual(["home:data-may-changed"]);
    });
  }

  test("does not submit when the Go registration group is missing", async () => {
    const page = setup({ groupId: "" });
    await page.handleSelectTeamMemberStand(1);
    expect(requests).toEqual([]);
    expect(page.notices).toEqual(["未找到可报名分组"]);
    expect(page.state.currentStatus.value).toEqual("待定");
  });

  test("keeps local registration unchanged when the backend rejects submission", async () => {
    const page = setup();
    requestFails = true;
    await page.handleSelectTeamMemberStand(1);
    expect(page.state.currentStatus.value).toEqual("待定");
    expect(page.events).toEqual([]);
    expect(page.notices).toEqual(["报名人数已满"]);
    expect(page.state.submittingStatus.value).toEqual(false);
  });

  test("does not submit after registration closes", async () => {
    const page = setup({ closed: true });
    await page.handleSelectTeamMemberStand(1);
    expect(requests).toEqual([]);
    expect(page.notices).toEqual(["报名已结束"]);
  });

  test("keeps paid pickup registrations locked", async () => {
    const page = setup({ paid: true });
    await page.handleSelectIndividualSignup();
    expect(requests).toEqual([]);
    expect(page.notices).toEqual(["已支付的报名不可修改或取消"]);
  });
});
