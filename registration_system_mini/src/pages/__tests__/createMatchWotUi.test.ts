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
    expect(source.includes('"^wd-(.*)": "wot-design-uni/components/wd-$1/wd-$1.vue"')).toEqual(true);
  });

  test("uses shared Wot datetime picker form for create match time fields", async () => {
    const source = await read("src/components/MatchPublishForm.vue");
    const pageSource = await read("src/pages/matches/create/index.vue");

    expect(source.match(/<wd-datetime-picker/g)?.length).toEqual(3);
    expect(source.includes('title="选择比赛时间"')).toEqual(true);
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

  test("keeps match time separate from registration time fields", async () => {
    const source = await read("src/components/MatchPublishForm.vue");
    const matchTimeLabelIndex = source.indexOf('text="比赛时间"');
    const matchTimeWrapper = source.slice(Math.max(0, matchTimeLabelIndex - 120), matchTimeLabelIndex);

    expect(matchTimeLabelIndex > 0).toEqual(true);
    expect(matchTimeWrapper.includes("create-form-item create-form-item-full")).toEqual(true);
    expect(source.includes("报名开始")).toEqual(true);
    expect(source.includes("报名截止")).toEqual(true);
  });

  test("formats Wot datetime picker columns with Chinese units", async () => {
    const source = await read("src/components/MatchPublishForm.vue");

    expect(source.includes("function formatDateTimeColumn")).toEqual(true);
    expect(source.match(/:formatter="formatDateTimeColumn"/g)?.length).toEqual(3);
    expect(source.includes('year: "年"')).toEqual(true);
    expect(source.includes('month: "月"')).toEqual(true);
    expect(source.includes('date: "日"')).toEqual(true);
    expect(source.includes('hour: "时"')).toEqual(true);
    expect(source.includes('minute: "分"')).toEqual(true);
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
});
