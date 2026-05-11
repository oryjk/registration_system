import { describe, expect, test } from "bun:test";
import { applyH5TencentMapConfig } from "@/config/h5Map";

describe("applyH5TencentMapConfig", () => {
  test("injects qqMapKey into __uniConfig when H5 env provides tencent key", () => {
    const uniConfig = {};

    applyH5TencentMapConfig(uniConfig, {
      VITE_TENCENT_MAP_KEY: "test-qq-key",
    });

    expect(uniConfig).toEqual({
      qqMapKey: "test-qq-key",
    });
  });

  test("keeps existing qqMapKey when runtime config already has one", () => {
    const uniConfig = {
      qqMapKey: "existing-key",
    };

    applyH5TencentMapConfig(uniConfig, {
      VITE_TENCENT_MAP_KEY: "test-qq-key",
    });

    expect(uniConfig).toEqual({
      qqMapKey: "existing-key",
    });
  });
});
