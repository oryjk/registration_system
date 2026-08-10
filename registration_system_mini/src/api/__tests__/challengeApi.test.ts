import { describe, expect, test } from "bun:test";
import { sourcePath } from "@/test/sourcePaths";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

const apiPath = sourcePath("api/challenge.ts");

describe("challenge api", () => {
  test("allows public challenge list reads while keeping team-scoped reads authenticated", async () => {
    const source = await Bun.file(apiPath).text();

    expect(source.includes("teamId?: number;")).toEqual(true);
    expect(source.includes("auth?: boolean;")).toEqual(true);
    expect(source.includes("auth: params.auth ?? !!params.teamId")).toEqual(true);
  });
});
