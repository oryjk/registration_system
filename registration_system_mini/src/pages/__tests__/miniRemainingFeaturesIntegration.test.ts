import { describe, expect, test } from "bun:test";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

const miniRoot = "/Users/carlwang/registration_system/registration_system_mini";
const backendRoot = "/Users/carlwang/registration_system/registration_system_rs";

async function read(path: string) {
  return Bun.file(path).text();
}

describe("remaining mini real backend integrations", () => {
  test("documents the remaining mini feature plan in the root task plan", async () => {
    const source = await read("/Users/carlwang/registration_system/task_plan.md");

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
    const page = await read(`${miniRoot}/src/pages/profile/setup/index.vue`);

    expect(runtimeConfig.includes("require_phone_binding: false")).toEqual(true);
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
    const page = await read(`${miniRoot}/src/pages/teams/manage/index.vue`);
    const state = await read(`${miniRoot}/src/pages/teams/manage/teamManageState.ts`);

    expect(teamApi.includes("export function addTeamMember")).toEqual(true);
    expect(teamApi.includes('url: `/teams/${teamId}/members`')).toEqual(true);
    expect(teamApi.includes("export function updateTeamMember")).toEqual(true);
    expect(teamApi.includes('url: `/teams/${teamId}/members/${userId}`')).toEqual(true);
    expect(teamApi.includes("export function removeTeamMember")).toEqual(true);
    expect(teamApi.includes("export function batchUpdateTeamMemberStatus")).toEqual(true);
    expect(teamApi.includes('url: `/teams/${teamId}/members/batch`')).toEqual(true);

    expect(state.includes('export type TeamManageMode = "profile" | "create" | "join" | "members";')).toEqual(true);
    expect(page.includes("activeMode = ref<TeamManageMode>")).toEqual(true);
    expect(page.includes("activeMode === 'members'")).toEqual(true);
    expect(page.includes("handleAddMember")).toEqual(true);
    expect(page.includes("handleUpdateMember")).toEqual(true);
    expect(page.includes("handleRemoveMember")).toEqual(true);
    expect(page.includes("handleToggleMemberStatus")).toEqual(true);
    expect(page.includes("队员管理")).toEqual(true);
  });

  test("match detail can submit post-match review and update check-in config", async () => {
    const activityApi = await read(`${miniRoot}/src/api/activity.ts`);
    const teamApi = await read(`${miniRoot}/src/api/team.ts`);
    const page = await read(`${miniRoot}/src/pages/matches/detail.vue`);
    const pageLogic = await read(`${miniRoot}/src/pages/matches/useMatchDetailPage.ts`);
    const actions = await read(`${miniRoot}/src/pages/matches/detailActions.ts`);
    const teamRegistration = await read(`${miniRoot}/src/pages/matches/components/MatchTeamRegistration.vue`);
    const checkInSettings = await read(`${miniRoot}/src/pages/matches/components/TeamCheckInSettingsCard.vue`);
    const activityReview = await read(`${miniRoot}/src/pages/matches/components/TeamActivityReviewCard.vue`);

    expect(activityApi.includes("export function updateTeamCheckInConfig")).toEqual(true);
    expect(teamApi.includes("submitTeamActivityReview")).toEqual(true);
    expect(actions.includes("updateTeamCheckInConfig")).toEqual(true);
    expect(actions.includes("submitTeamActivityReview")).toEqual(true);
    expect(pageLogic.includes("saveMatchCheckInConfig")).toEqual(true);
    expect(pageLogic.includes("submitMatchActivityReview")).toEqual(true);
    expect(pageLogic.includes("handleSaveCheckInConfig")).toEqual(true);
    expect(pageLogic.includes("handleSubmitActivityReview")).toEqual(true);
    expect(page.includes("MatchTeamRegistration")).toEqual(true);
    expect(teamRegistration.includes("TeamCheckInSettingsCard")).toEqual(true);
    expect(checkInSettings.includes("签到设置")).toEqual(true);
    expect(activityReview.includes("赛后互评")).toEqual(true);
  });

  test("billing page supports recharge orders and payment order management", async () => {
    const paymentApi = await read(`${miniRoot}/src/api/payment.ts`);
    const page = await read(`${miniRoot}/src/pages/billing/index.vue`);

    expect(paymentApi.includes("export function createRechargeOrder")).toEqual(true);
    expect(paymentApi.includes('url: "/payment/recharge"')).toEqual(true);
    expect(paymentApi.includes("export function listPaymentOrders")).toEqual(true);
    expect(paymentApi.includes('url: `/payment/orders')).toEqual(true);
    expect(paymentApi.includes("export function cancelPaymentOrder")).toEqual(true);
    expect(paymentApi.includes('url: "/payment/cancel"')).toEqual(true);
    expect(page.includes("handleRecharge")).toEqual(true);
    expect(page.includes("listPaymentOrders")).toEqual(true);
    expect(page.includes("handleSyncOrder")).toEqual(true);
    expect(page.includes("handleCancelOrder")).toEqual(true);
    expect(page.includes("充值")).toEqual(true);
    expect(page.includes("支付订单")).toEqual(true);
  });

  test("location resolution goes through app backend activity routes", async () => {
    const activityApi = await read(`${miniRoot}/src/api/activity.ts`);
    const locationUtil = await read(`${miniRoot}/src/utils/location.ts`);
    const backendRoutes = await read(`${backendRoot}/src/activity/adapters/web/routes.rs`);

    expect(activityApi.includes("export function searchActivityLocations")).toEqual(true);
    expect(activityApi.includes('url: `/activity/location-search')).toEqual(true);
    expect(activityApi.includes("export function resolveActivityLocation")).toEqual(true);
    expect(activityApi.includes('url: `/activity/location-resolve')).toEqual(true);
    expect(locationUtil.includes("resolveActivityLocation")).toEqual(true);
    expect(locationUtil.includes("resolveBackendLocationLabel")).toEqual(true);
    expect(backendRoutes.includes('.route("/location-search", get(search_locations_handler))')).toEqual(true);
    expect(backendRoutes.includes('.route("/location-resolve", get(resolve_location_handler))')).toEqual(true);
  });
});
