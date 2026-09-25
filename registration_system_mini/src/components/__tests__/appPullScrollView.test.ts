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

describe("AppPullScrollView", () => {
  test("disables H5 browser scroll anchoring while the refresher collapses", async () => {
    const source = await read("src/components/AppPullScrollView.vue");

    expect(source.includes("overflow-anchor: none;")).toEqual(true);
    expect(source.includes(".app-pull-scroll :deep(.uni-scroll-view)")).toEqual(true);
  });
});
