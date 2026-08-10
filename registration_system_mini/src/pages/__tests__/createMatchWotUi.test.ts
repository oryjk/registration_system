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
    const source = await read("src/components/MatchPublishForm.vue");
    const pageSource = await read("src/pages/matches/create/index.vue");

    expect((source.match(/<picker/g)?.length ?? 0) >= 3).toEqual(true);
    expect(source.includes('mode="date"')).toEqual(true);
    expect(source.match(/mode="time"/g)?.length).toEqual(2);
    expect(source.includes("<wd-datetime-picker")).toEqual(false);
    expect(source.includes("比赛日期")).toEqual(true);
    expect(source.includes("比赛开始时间")).toEqual(true);
    expect(source.includes("比赛结束时间")).toEqual(true);
    expect(source.includes("报名开始")).toEqual(false);
    expect(source.includes("报名截止")).toEqual(false);
    expect(source.includes('placeholder="YYYY-MM-DD hh:mm:ss"')).toEqual(false);
    expect(source.includes("date-option-active")).toEqual(true);
    expect(source.includes("displayTimeLabel")).toEqual(true);
    expect(pageSource.includes('import type { MatchPublishFormModel } from "@/components/matchPublishForm"')).toEqual(true);
    expect(pageSource.includes('import { toBackendDateTime')).toEqual(false);
    expect(pageSource.includes("function toBackendDateTime")).toEqual(true);
    expect(pageSource.includes("submittedAtTimestamp")).toEqual(true);
    expect(pageSource.includes("MatchPublishForm")).toEqual(true);
  });

  test("shows date first, then start and end time for create match", async () => {
    const source = await read("src/components/MatchPublishForm.vue");

    expect(source.includes("date-option-scroll")).toEqual(true);
    expect(source.includes("比赛日期")).toEqual(true);
    expect(source.includes("比赛开始时间")).toEqual(true);
    expect(source.includes("比赛结束时间")).toEqual(true);
    expect(source.includes("handleSelectDateOption")).toEqual(true);
    expect(source.includes("handleMatchStartTimeChange")).toEqual(true);
    expect(source.includes("handleMatchEndTimeChange")).toEqual(true);
  });

  test("displays selected date and time values with weekday context", async () => {
    const source = await read("src/components/MatchPublishForm.vue");

    expect(source.includes("function displayDateLabel")).toEqual(true);
    expect(source.includes("function displayTimeLabel")).toEqual(true);
    expect(source.includes("buildRecentDateOptions")).toEqual(true);
    expect(source.includes('"周日", "周一", "周二", "周三", "周四", "周五", "周六"')).toEqual(true);
    expect(source.includes('return `${pad(date.getMonth() + 1)}月')).toEqual(true);
  });

  test("uses native input and Wot textarea components for editable fields", async () => {
    const source = await read("src/components/MatchPublishForm.vue");

    expect(source.includes("<wd-input")).toEqual(false);
    expect((source.match(/<input/g)?.length ?? 0) >= 7).toEqual(true);
    expect(source.match(/<wd-textarea/g)?.length).toEqual(1);
    expect(source.includes("<textarea")).toEqual(false);
    expect(source.includes("create-native-input")).toEqual(true);
    expect(source.includes("custom-textarea-class=\"create-wot-textarea-inner\"")).toEqual(true);
  });

  test("declares chooseLocation private api for map location picking", async () => {
    const source = await read("src/manifest.json");

    expect(source.includes('"getLocation"')).toEqual(true);
    expect(source.includes('"chooseLocation"')).toEqual(true);
  });

  test("supports manual location input and optional map coordinates", async () => {
    const source = await read("src/components/MatchPublishForm.vue");

    expect(source.includes("function handleLocationInput")).toEqual(true);
    expect(source.includes('@input="handleLocationInput"')).toEqual(true);
    expect(source.includes('placeholder="输入球场/地址，或使用地图选择"')).toEqual(true);
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
    expect(source.includes("async function handleSubmit() {\n  if (await guardReviewMode()) return;")).toEqual(true);
  });

  test("syncs runtime version to the upload version before building", async () => {
    const source = await read("scripts/mini-ci.mjs");

    expect(source.includes("syncManifestVersion({ versionName: uploadVersion })")).toEqual(true);
    expect(source.indexOf("syncManifestVersion({ versionName: uploadVersion })") < source.indexOf("spawn(\"node\", [cliPath")).toEqual(true);
    expect(source.includes("MINI_PROGRAM_VERSION: uploadVersion")).toEqual(true);
  });

  test("derives registration times from submit time and match start time", async () => {
    const source = await read("src/pages/matches/create/index.vue");

    expect(source.includes("const submittedAtTimestamp = Date.now();")).toEqual(true);
    expect(source.includes("const registrationDeadlineTimestamp = normalizeToMinute(form.holdingDate - 24 * 60 * 60 * 1000);")).toEqual(true);
    expect(source.includes("start_time: toBackendDateTime(submittedAtTimestamp),")).toEqual(true);
    expect(source.includes("end_time: toBackendDateTime(registrationDeadlineTimestamp),")).toEqual(true);
    expect(source.includes("matchEndTime")).toEqual(true);
  });
});
