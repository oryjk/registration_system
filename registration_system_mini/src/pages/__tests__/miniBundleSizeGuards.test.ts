import { describe, expect, test } from "bun:test";
import { miniPath } from "@/test/sourcePaths";

declare const Bun: {
  file(path: string): { text(): Promise<string> };
};

async function read(path: string) {
  return Bun.file(miniPath(path)).text();
}

describe("mini production bundle size guards", () => {
  test("keeps H5-only mock imports out of mp-weixin source compilation", async () => {
    const request = await read("src/utils/request.ts");
    const session = await read("src/stores/appSession.ts");

    expect(request.includes("// #ifdef H5\nimport { isMockEnabled, tryMockRequest } from \"@/mock\";\n// #endif")).toEqual(true);
    expect(session.includes("// #ifdef H5\nimport { isMockEnabled } from \"@/mock\";\n// #endif")).toEqual(true);
    expect(request.includes("// #ifdef H5\n  if (isMockEnabled())")).toEqual(true);
    expect(session.includes("// #ifdef H5\n      if (isMockEnabled())")).toEqual(true);
  });

  test("uses a remote default share cover instead of bundling the 73KB local image", async () => {
    const share = await read("src/utils/share.ts");

    expect(share.includes('DEFAULT_SHARE_IMAGE_URL = "https://')).toEqual(true);
    expect(share.includes('DEFAULT_SHARE_IMAGE_URL = "/static/share/share-cover.png"')).toEqual(false);
  });

  test("uses the measured-smaller WeChat upload settings and excludes development-only static material", async () => {
    const ci = await read("scripts/mini-ci.mjs");

    // 微信 Preview 实测：当前工具链打开 minify 后 __FULL__ 反而大约 49KB，因此保留关闭状态。
    expect(ci.includes("minifyJS: false")).toEqual(true);
    expect(ci.includes("minifyWXML: false")).toEqual(true);
    expect(ci.includes("minifyWXSS: false")).toEqual(true);
    expect(ci.includes('"static/**/*.svg"')).toEqual(true);
    expect(ci.includes('"static/icons/lucide/README.md"')).toEqual(true);
    expect(ci.includes('"static/icons/lucide/LICENSE"')).toEqual(true);
    expect(ci.includes('"static/share/share-cover.png"')).toEqual(true);
  });
});
