import { describe, expect, test } from "bun:test";
import { miniPath, workspacePath } from "@/test/sourcePaths";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

const miniRoot = miniPath("").replace(/\/$/, "");
const backendRoot = workspacePath("registration_system_rs").replace(/\/$/, "");

async function read(path: string) {
  return Bun.file(path).text();
}

describe("remaining mini real backend integrations", () => {
  test("documents the remaining mini feature plan in the root task plan", async () => {
    const source = await read(workspacePath("task_plan.md"));

    expect(source.includes("手机号绑定")).toEqual(true);
    expect(source.includes("球队成员管理")).toEqual(true);
    expect(source.includes("赛后球队互评 / 队费复盘")).toEqual(true);
    expect(source.includes("签到配置后续修改")).toEqual(true);
    expect(source.includes("钱包充值 / 订单管理")).toEqual(true);
    expect(source.includes("地图与系统配置")).toEqual(true);
  });

  test("profile setup binds WeChat phone number through real backend APIs", async () => {
    const wxApi = await read(`${miniRoot}/src/api/wx.ts`);
    const userApi = await read(`${miniRoot}/src/api/user.ts`);
    const runtimeConfig = await read(`${miniRoot}/src/config/runtimeConfig.ts`);
    const runtimeConfigDefaults = await read(`${miniRoot}/src/config/runtimeConfigDefaults.ts`);
    const page = await read(`${miniRoot}/src/pages/profile/setup/index.vue`);

    expect(runtimeConfigDefaults.includes("require_phone_binding: false")).toEqual(true);
    expect(runtimeConfig.includes("defaults.profile.require_phone_binding")).toEqual(true);
    expect(wxApi.includes("export function getPhoneNumber")).toEqual(true);
    expect(wxApi.includes('url: "/wx/getPhoneNumber"')).toEqual(true);
    expect(userApi.includes("export function bindMyPhoneNumber")).toEqual(true);
    expect(userApi.includes('url: "/user/phone"')).toEqual(true);
    expect(page.includes("loadMiniAppRuntimeConfig")).toEqual(true);
    expect(page.includes("shouldShowPhoneBinding.value = config.profile.require_phone_binding")).toEqual(true);
    expect(page.includes('v-if="shouldShowPhoneBinding"')).toEqual(true);
    expect(page.includes("shouldShowPhoneBinding.value && phoneInput.value.trim()")).toEqual(true);
    expect(page.includes('open-type="getPhoneNumber"')).toEqual(true);
    expect(page.includes("@getphonenumber=\"handleGetPhoneNumber\"")).toEqual(true);
    expect(page.includes("getPhoneNumber")).toEqual(true);
    expect(page.includes("bindMyPhoneNumber")).toEqual(true);
  });

  test("team manage page exposes real team member management operations", async () => {
    const teamApi = await read(`${miniRoot}/src/api/team.ts`);
    const page = (await Promise.all([
      `${miniRoot}/src/pages/teams/manage/index.vue`,
      `${miniRoot}/src/pages/teams/manage/useTeamManagePage.ts`,
      `${miniRoot}/src/pages/teams/manage/useTeamMembership.ts`,
    ].map(read))).join("\n");
    const state = await read(`${miniRoot}/src/pages/teams/manage/teamManageState.ts`);

    expect(teamApi.includes("export function addTeamMember")).toEqual(true);
    expect(teamApi.includes('url: `/teams/${teamId}/members`')).toEqual(true);
    expect(teamApi.includes("export function updateTeamMember")).toEqual(true);
    expect(teamApi.includes('url: `/teams/${teamId}/members/${userId}`')).toEqual(true);
    expect(teamApi.includes("export function removeTeamMember")).toEqual(true);
    // Go app 侧无批量接口；冻结/恢复走单人 updateTeamMember 的 status 字段。
    expect(teamApi.includes("export function setTeamMemberActive")).toEqual(true);
    expect(teamApi.includes("batchUpdateTeamMemberStatus")).toEqual(false);

    expect(state.includes('export type TeamManageMode = "profile" | "members" | "attendance";')).toEqual(true);
    expect(page.includes("activeMode = ref<TeamManageMode>")).toEqual(true);
    expect(page.includes("activeMode === 'members'")).toEqual(true);
    expect(page.includes("handleAddMember")).toEqual(true);
    expect(page.includes("handleUpdateMember")).toEqual(true);
    expect(page.includes("handleRemoveMember")).toEqual(true);
    expect(page.includes("handleToggleMemberStatus")).toEqual(true);
    expect(page.includes("队员管理")).toEqual(true);
  });

  test("billing page supports recharge orders and payment order management", async () => {
    const paymentApi = await read(`${miniRoot}/src/api/payment.ts`);
    const page = await read(`${miniRoot}/src/pages/billing/index.vue`);

    expect(paymentApi.includes("export function createRechargeOrder")).toEqual(true);
    expect(paymentApi.includes('url: "/payments/recharge-orders"')).toEqual(true);
    expect(paymentApi.includes("export function listPaymentOrders")).toEqual(true);
    expect(paymentApi.includes('url: `/payments/orders')).toEqual(true);
    expect(paymentApi.includes("export function cancelPaymentOrder")).toEqual(true);
    expect(paymentApi.includes('url: `/payments/orders/${orderNo}/cancel`')).toEqual(true);
    expect(page.includes("handleRecharge")).toEqual(true);
    expect(page.includes("listPaymentOrders")).toEqual(true);
    expect(page.includes("handleSyncOrder")).toEqual(true);
    expect(page.includes("handleCancelOrder")).toEqual(true);
    expect(page.includes("充值")).toEqual(true);
    expect(page.includes("支付订单")).toEqual(true);
  });

});
