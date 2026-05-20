import { describe, expect, test } from "bun:test";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

const miniRoot = "/Users/carlwang/registration_system/registration_system_mini";

async function read(path: string) {
  return Bun.file(`${miniRoot}/${path}`).text();
}

describe("create match Wot UI integration", () => {
  test("registers Wot Design Uni through easycom", async () => {
    const source = await read("src/pages.json");

    expect(source.includes('"easycom"')).toEqual(true);
    expect(source.includes('"^wd-(.*)": "@wot-ui/ui/components/wd-$1/wd-$1.vue"')).toEqual(true);
  });

  test("uses calendar datetime pickers for create match time fields", async () => {
    const source = await read("src/components/MatchPublishForm.vue");
    const pageSource = await read("src/pages/matches/create/index.vue");

    expect(source.match(/<wd-calendar/g)?.length).toEqual(3);
    expect(source.includes("<wd-datetime-picker")).toEqual(false);
    expect(source.includes('title="选择比赛时间"')).toEqual(true);
    expect(source.includes('placeholder="请选择比赛时间"')).toEqual(true);
    expect(source.includes('选择报名开始时间')).toEqual(true);
    expect(source.includes('选择报名截止时间')).toEqual(true);
    expect(source.includes('placeholder="YYYY-MM-DD hh:mm:ss"')).toEqual(false);
    expect(source.includes("displayDateTime")).toEqual(true);
    expect(pageSource.includes('import type { MatchPublishFormModel } from "@/components/matchPublishForm"')).toEqual(true);
    expect(pageSource.includes('import { toBackendDateTime')).toEqual(false);
    expect(pageSource.includes("function toBackendDateTime")).toEqual(true);
    expect(source.includes("function displayDateTime")).toEqual(true);
    expect(pageSource.includes("MatchPublishForm")).toEqual(true);
  });

  test("combines match date and clock into one match time field", async () => {
    const source = await read("src/components/MatchPublishForm.vue");

    expect(source.includes("比赛时间")).toEqual(true);
    expect(source.includes("比赛日期")).toEqual(false);
    expect(source.includes("开球时间")).toEqual(false);
    expect(source.includes('v-model="form.holdingDate"')).toEqual(true);
    expect(source.includes('type="datetime"')).toEqual(true);
    expect(source.includes("报名开始")).toEqual(true);
    expect(source.includes("报名截止")).toEqual(true);
  });

  test("displays selected datetime values with weekday context", async () => {
    const source = await read("src/components/MatchPublishForm.vue");

    expect(source.includes("function displayDateTimeLabel")).toEqual(true);
    expect(source.includes('"周日", "周一", "周二", "周三", "周四", "周五", "周六"')).toEqual(true);
    expect(source.includes("return displayDateTimeLabel(date.getTime());")).toEqual(true);
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

  test("links registration default times to the selected match time", async () => {
    const source = await read("src/pages/matches/create/index.vue");

    expect(source.includes("function defaultRegistrationStartTime")).toEqual(true);
    expect(source.includes("function defaultRegistrationEndTime")).toEqual(true);
    expect(source.includes("holdingDate - 24 * 60 * 60 * 1000")).toEqual(true);
    expect(source.includes("holdingDate - 60 * 60 * 1000")).toEqual(true);
    expect(source.includes("form.startTime = defaultRegistrationStartTime(val);")).toEqual(true);
    expect(source.includes("form.endTime = defaultRegistrationEndTime(val);")).toEqual(true);
    expect(source.includes("date.setHours(20, 0, 0, 0);")).toEqual(true);
  });
});
