import { describe, expect, test } from "bun:test";
import { miniPath } from "@/test/sourcePaths";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

describe("TeamDissolvePanel", () => {
  test("uses the same full-width action alignment as the other team profile panels", async () => {
    const source = await Bun.file(
      miniPath("src/pages/teams/manage/components/TeamDissolvePanel.vue"),
    ).text();

    expect(source.includes('variant="danger"')).toEqual(true);
    expect(source.includes("      block")).toEqual(true);
    expect(source.includes('size="sm"')).toEqual(false);
    expect(source.includes("justify-content: flex-end")).toEqual(false);
  });
});
