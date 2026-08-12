import { describe, expect, test } from "bun:test";
import { sourcePath } from "@/test/sourcePaths";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

describe("view model module structure", () => {
  test("keeps the legacy entry point as a small domain barrel", async () => {
    const source = await Bun.file(sourcePath("utils/viewModels.ts")).text();

    expect(source.includes('export * from "./viewModels/common"')).toEqual(true);
    expect(source.includes('export * from "./viewModels/team"')).toEqual(true);
    expect(source.includes('export * from "./viewModels/homeMatches"')).toEqual(true);
    expect(source.includes('export * from "./viewModels/challenges"')).toEqual(true);
    expect(source.includes('export * from "./viewModels/finance"')).toEqual(true);
    expect(source.includes('export * from "./viewModels/notifications"')).toEqual(true);
    expect(source.split("\n").length < 20).toEqual(true);
  });
});
