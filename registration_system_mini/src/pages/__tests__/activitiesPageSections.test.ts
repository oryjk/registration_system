import { describe, expect, test } from "bun:test";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

describe("activities page sections", () => {
  test("splits challenge hall into team and individual sections", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/activities/index.vue",
    ).text();

    expect(source.includes("球队约队")).toEqual(true);
    expect(source.includes("散人约队")).toEqual(true);
    expect(source.includes("const teamHallCards = computed")).toEqual(true);
    expect(source.includes("const individualHallCards = computed")).toEqual(true);
  });

  test("uses team manager permission for accepting team challenges", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/activities/index.vue",
    ).text();

    expect(source.includes("currentTeam.value?.canManageTeam")).toEqual(true);
    expect(source.includes('card.kind === "team"')).toEqual(true);
    expect(source.includes("散人约队同一时间只能接一场")).toEqual(true);
  });

  test("opens a publish type sheet and navigates to dedicated create pages", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/activities/index.vue",
    ).text();

    expect(source.includes("function openPublishTypeSheet")).toEqual(true);
    expect(source.includes("uni.showActionSheet")).toEqual(true);
    expect(source.includes('itemList: ["球队约队", "散人约队"]')).toEqual(true);
    expect(source.includes('url: "/pages/matches/create/index"')).toEqual(true);
    expect(source.includes('url: "/pages/challenges/create-individual/index"')).toEqual(true);
    expect(source.includes("createChallenge")).toEqual(false);
    expect(source.includes("<MatchPublishForm")).toEqual(false);
    expect(source.includes("showCreateForm")).toEqual(false);
  });

  test("registers individual challenge creation page", async () => {
    const pages = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages.json",
    ).text();
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/challenges/create-individual/index.vue",
    ).text();

    expect(pages.includes('"path": "pages/challenges/create-individual/index"')).toEqual(true);
    expect(source.includes('createChallenge')).toEqual(true);
    expect(source.includes('kind: "individual"')).toEqual(true);
    expect(source.includes("散人约队同一时间只能接一场")).toEqual(true);
  });
});
