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

  test("uses team manager permission for team challenges and sends challenge kind when publishing", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/activities/index.vue",
    ).text();

    expect(source.includes("currentTeam.value?.canManageTeam")).toEqual(true);
    expect(source.includes("kind: publishForm.kind")).toEqual(true);
    expect(source.includes('card.kind === "team"')).toEqual(true);
    expect(source.includes("散人约队同一时间只能接一场")).toEqual(true);
  });
});
