import { describe, expect, test } from "bun:test";
import { miniPath } from "@/test/sourcePaths";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

async function read(path: string) {
  return Bun.file(miniPath(path)).text();
}

describe("create match Wot UI integration", () => {
  test("registers Wot Design Uni through easycom", async () => {
    const source = await read("src/pages.json");

    expect(source.includes('"easycom"')).toEqual(true);
    expect(source.includes('"^wd-(.*)": "@wot-ui/ui/components/wd-$1/wd-$1.vue"')).toEqual(true);
  });

  test("uses native date and time pickers for create match time fields", async () => {
    const source = await read("src/components/MatchScheduleFields.vue");
    const pageSource = await read("src/pages/matches/create/index.vue");
    const payloadSource = await read("src/pages/matches/create/createMatchPayload.ts");

    expect((source.match(/<picker/g)?.length ?? 0) >= 3).toEqual(true);
    expect(source.includes('mode="date"')).toEqual(true);
    expect(source.match(/mode="time"/g)?.length).toEqual(2);
    expect(source.includes("<wd-datetime-picker")).toEqual(false);
    // 时间区为「时间磁贴」：日期 + 开始/结束时间磁贴，仍走原生 picker。
    expect(source.includes("比赛日期")).toEqual(true);
    expect(source.includes("time-tile-label")).toEqual(true);
    expect(source.includes("开始时间")).toEqual(true);
    expect(source.includes("结束时间")).toEqual(true);
    expect(source.includes("报名开始")).toEqual(false);
    expect(source.includes("报名截止")).toEqual(false);
    expect(source.includes('placeholder="YYYY-MM-DD hh:mm:ss"')).toEqual(false);
    expect(source.includes("date-option-active")).toEqual(true);
    expect(source.includes("displayTimeLabel")).toEqual(true);
    expect(pageSource.includes('import type { MatchPublishFormModel } from "./components/matchPublishFormModel"')).toEqual(true);
    // 时间序列化已收敛到 createMatchPayload：页面不再自带 toBackendDateTime/提交时刻推导。
    expect(pageSource.includes("toBackendDateTime")).toEqual(false);
    expect(pageSource.includes("submittedAtTimestamp")).toEqual(false);
    expect(pageSource.includes("buildCreateMatchPayload")).toEqual(true);
    expect(payloadSource.includes("start_time: new Date(form.holdingDate).toISOString()")).toEqual(true);
    expect(payloadSource.includes("end_time: new Date(form.matchEndTime).toISOString()")).toEqual(true);
    expect(pageSource.includes("MatchPublishForm")).toEqual(true);
  });

  test("shows date first, then start and end time for create match", async () => {
    const source = await read("src/components/MatchScheduleFields.vue");

    expect(source.includes("date-option-scroll")).toEqual(true);
    expect(source.includes("比赛日期")).toEqual(true);
    expect(source.includes("开始时间")).toEqual(true);
    expect(source.includes("结束时间")).toEqual(true);
    expect(source.includes("handleSelectDateOption")).toEqual(true);
    expect(source.includes("handleMatchStartTimeChange")).toEqual(true);
    expect(source.includes("handleMatchEndTimeChange")).toEqual(true);
  });

  test("displays selected date and time values with weekday context", async () => {
    const source = await read("src/components/MatchScheduleFields.vue");

    expect(source.includes("function displayTimeLabel")).toEqual(true);
    expect(source.includes("buildRecentDateOptions")).toEqual(true);
    expect(source.includes('"周日", "周一", "周二", "周三", "周四", "周五", "周六"')).toEqual(true);
    expect(source.includes('monthLabel: `${pad(date.getMonth() + 1)}月`')).toEqual(true);
  });

  test("uses native input and textarea components for editable fields", async () => {
    const source = await read("src/pages/matches/create/components/MatchPublishForm.vue");

    expect(source.includes("<wd-input")).toEqual(false);
    expect((source.match(/<input/g)?.length ?? 0) >= 7).toEqual(true);
    expect((source.match(/<wd-textarea/g)?.length ?? 0)).toEqual(0);
    expect((source.match(/<textarea/g)?.length ?? 0) >= 1).toEqual(true);
    expect(source.includes("form-input")).toEqual(true);
  });

  test("styles the publish form with the current design system", async () => {
    const source = await read("src/pages/matches/create/components/MatchPublishForm.vue");
    const pageSource = await read("src/pages/matches/create/index.vue");

    expect(source.includes('import SegmentedControl from "@/components/ui/SegmentedControl.vue"')).toEqual(true);
    expect(source.includes('import AppSurface from "@/components/ui/AppSurface.vue"')).toEqual(true);
    expect(source.includes('import SectionHeader from "@/components/ui/SectionHeader.vue"')).toEqual(true);
    expect(source.includes("<SegmentedControl")).toEqual(true);
    expect(source.includes('custom-class="form-card"')).toEqual(true);
    // 表单皮肤用 语义 token；球衣色板（colorOptions）允许保留 hex 色值。
    expect(source.includes("border-radius: 24rpx")).toEqual(false);
    expect(source.includes("var(--ui-color")).toEqual(true);
    expect(pageSource.includes('import StickyActionBar from "@/components/ui/StickyActionBar.vue"')).toEqual(true);
    expect(pageSource.includes('variant="outlined" custom-class="create-hero"')).toEqual(true);
    expect(pageSource.includes("<AppButton block variant=\"lime\"")).toEqual(true);
    expect(pageSource.includes("#c8ff00")).toEqual(false);
    expect(pageSource.includes("#111310")).toEqual(false);
  });

  test("declares chooseLocation private api for map location picking", async () => {
    const source = await read("src/manifest.json");

    expect(source.includes('"getLocation"')).toEqual(true);
    expect(source.includes('"chooseLocation"')).toEqual(true);
  });

  test("supports manual location input and optional map coordinates", async () => {
    const source = await read("src/pages/matches/create/components/MatchPublishForm.vue");

    // 场地通过选择弹层录入（常用场地/手动输入/地图选点），表单只保留点击入口。
    expect(source.includes("function handleOpenVenuePicker")).toEqual(true);
    expect(source.includes("@tap=\"handleOpenVenuePicker\"")).toEqual(true);
    expect(source.includes("启用签到时请用地图选择经纬度")).toEqual(true);
    expect(source.includes("form.enableCheckIn")).toEqual(true);
    expect(source.includes("locationLatitude")).toEqual(true);
    expect(source.includes("locationLongitude")).toEqual(true);
  });

  test("does not show the current team role badge in create match hero", async () => {
    const source = await read("src/pages/matches/create/index.vue");

    expect(source.includes("create-hero-role")).toEqual(false);
    expect(source.includes("myRoleLabel")).toEqual(false);
  });

  test("guards create match page during review mode even with direct navigation", async () => {
    const source = await read("src/pages/matches/create/index.vue");

    expect(source.includes('import { preloadMiniReviewStatus, useMiniReviewStatus } from "@/stores/miniReview"')).toEqual(true);
    expect(source.includes("async function guardReviewMode")).toEqual(true);
    expect(source.includes("await preloadMiniReviewStatus();")).toEqual(true);
    expect(source.includes("if (!shouldHideCreationEntrances.value) return false;")).toEqual(true);
    expect(source.includes("审核状态下暂不开放创建比赛")).toEqual(true);
    expect(source.includes("uni.navigateBack")).toEqual(true);
    expect(source.includes('uni.switchTab({ url: "/pages/home/index" });')).toEqual(true);
    expect(source.includes('const reviewGateReady = ref(false);')).toEqual(true);
    expect(source.includes('v-if="reviewGateReady"')).toEqual(true);
    expect(source.includes("async function handleSubmit() {\n  if (!editId.value && await guardReviewMode()) return;")).toEqual(true);
  });

  test("routes mini-program builds and uploads through the production-safe Bun entry", async () => {
    const { scripts } = JSON.parse(await read("package.json"));
    const scriptSource = await read("scripts/mini-ci.mjs");

    expect(scripts["prebuild:mp-weixin"]).toEqual(undefined);
    expect(scripts["build:mp-weixin"]).toEqual("bun --no-env-file scripts/mini-release.mjs build");
    expect(scripts["mp:release"]).toEqual("bun --no-env-file scripts/mini-release.mjs upload");
    expect(scripts["mp:preview"]).toEqual("bun --no-env-file scripts/mini-release.mjs preview");
    expect(scriptSource.includes("version: manifest.versionName")).toEqual(true);
  });

  test("payload times come from the schedule pickers and omit the registration window", async () => {
    const payloadSource = await read("src/pages/matches/create/createMatchPayload.ts");

    // 时间契约（与 createMatchPayload.test.ts 的行为用例一致）：
    // start/end 直接来自表单的比赛开始/结束选择器，不再从提交时刻或"开赛前 24h"推导。
    expect(payloadSource.includes("start_time: new Date(form.holdingDate).toISOString()")).toEqual(true);
    expect(payloadSource.includes("end_time: new Date(form.matchEndTime).toISOString()")).toEqual(true);
    // 报名窗口不在表单内暴露：缺省由后端按"创建即开放、比赛状态控制截止"处理，
    // 避免发送不可见的相等时间对被后端拒绝。
    expect(payloadSource.includes("registration_start_at")).toEqual(false);
    expect(payloadSource.includes("registration_end_at")).toEqual(false);
  });
});
