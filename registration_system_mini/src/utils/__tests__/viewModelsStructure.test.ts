import { describe, expect, test } from "bun:test";
import { sourcePath } from "@/test/sourcePaths";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

describe("view model module structure", () => {
  test("keeps the shared entry point limited to current domain exports", async () => {
    const source = await Bun.file(sourcePath("utils/viewModels.ts")).text();

    expect(source.includes('export * from "./viewModels/common"')).toEqual(true);
    expect(source.includes('export * from "./viewModels/team"')).toEqual(true);
    expect(source.includes('export * from "./viewModels/finance"')).toEqual(true);
    expect(source.includes('export * from "./viewModels/notifications"')).toEqual(true);
    // Match presentation is page-owned (homeMatchState/hallMatchState), not a shared barrel API.
    expect(source.match(/export \* from/g)?.length).toEqual(4);
    expect(source.split("\n").length < 20).toEqual(true);
  });
});
