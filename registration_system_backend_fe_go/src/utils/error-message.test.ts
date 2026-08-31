import { describe, expect, it } from "vitest";
import { ApiError } from "@/api/client";
import { errorMessage } from "@/utils/error-message";

describe("errorMessage", () => {
  it("取 Error 的 message", () => {
    expect(errorMessage(new Error("球队保存失败"), "兜底")).toBe(
      "球队保存失败",
    );
  });

  it("取 ApiError 的 message", () => {
    expect(
      errorMessage(new ApiError("请求失败 (500)", 500, 1000), "兜底"),
    ).toBe("请求失败 (500)");
  });

  it("未知类型回退兜底文案", () => {
    expect(errorMessage("boom", "兜底")).toBe("兜底");
    expect(errorMessage(null, "兜底")).toBe("兜底");
    expect(errorMessage(undefined, "兜底")).toBe("兜底");
  });
});
