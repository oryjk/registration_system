import { describe, expect, test } from "bun:test";
import {
  KIT_COLOR_OPTIONS,
  findKitColorName,
  findKitColorShortName,
  formatKitSummary,
  isLightKitColor,
  kitStrokeColor,
  normalizeKitColorHex,
} from "../kitColors";

describe("kitColors", () => {
  test("maintains all 14 standard kit colors", () => {
    expect(KIT_COLOR_OPTIONS.length).toEqual(14);
    expect(KIT_COLOR_OPTIONS.map((item) => [item.name, item.value])).toEqual([
      ["白色", "#FFFFFF"],
      ["绿色", "#22C55E"],
      ["红色", "#EF4444"],
      ["蓝色", "#2F6BFF"],
      ["黑色", "#111310"],
      ["黄色", "#FACC15"],
      ["橙色", "#FF6B35"],
      ["紫色", "#B34DFF"],
      ["粉色", "#EC4899"],
      ["青色", "#06B6D4"],
      ["天蓝", "#38BDF8"],
      ["荧光绿", "#C8FF00"],
      ["银灰", "#D8DDE6"],
      ["灰色", "#94A3B8"],
    ]);
  });

  test("normalizes hex and named colors and resolves color names", () => {
    expect(normalizeKitColorHex("#fff")).toEqual("#FFFFFF");
    expect(normalizeKitColorHex(" #2f6bff ")).toEqual("#2F6BFF");
    expect(normalizeKitColorHex("黑色")).toEqual("#111310");
    expect(normalizeKitColorHex("red")).toEqual("#EF4444");
    expect(normalizeKitColorHex("")).toEqual("");

    expect(findKitColorName("#FFFFFF")).toEqual("白色");
    expect(findKitColorName("#c8ff00")).toEqual("荧光绿");
    expect(findKitColorName("#000000")).toEqual("黑色");
    expect(findKitColorName("#123456")).toEqual("");
    expect(findKitColorShortName("#38BDF8")).toEqual("天蓝");
    expect(findKitColorShortName("#111310")).toEqual("黑");
  });

  test("distinguishes light and dark kit colors and returns contrasting strokes", () => {
    expect(isLightKitColor("#FFFFFF")).toEqual(true);
    expect(isLightKitColor("#FACC15")).toEqual(true);
    expect(isLightKitColor("#C8FF00")).toEqual(true);
    expect(isLightKitColor("#D8DDE6")).toEqual(true);

    expect(isLightKitColor("#111310")).toEqual(false);
    expect(isLightKitColor("#2F6BFF")).toEqual(false);
    expect(isLightKitColor("#EF4444")).toEqual(false);
    expect(isLightKitColor("")).toEqual(false);

    // 浅色用深色边框，深色用浅色边框
    expect(kitStrokeColor("#FFFFFF") !== kitStrokeColor("#111310")).toEqual(true);
    expect(kitStrokeColor("#FFFFFF", true) !== kitStrokeColor("#111310", true)).toEqual(true);
  });

  test("formats kit summary strictly based on configured pieces", () => {
    expect(formatKitSummary({ shirt: "#FFFFFF", shorts: "#111310", socks: "#FFFFFF" })).toEqual("白衣 · 黑裤 · 白袜");
    expect(formatKitSummary({ shirt: "#FFFFFF", shorts: "#111310" })).toEqual("白衣 · 黑裤");
    expect(formatKitSummary({ shirt: "#C8FF00", socks: "#38BDF8" })).toEqual("荧光绿衣 · 天蓝袜");
    expect(formatKitSummary({ shirt: "#FFFFFF" })).toEqual("白衣");
    expect(formatKitSummary({ shirt: "", shorts: null, socks: undefined })).toEqual("队服待定");
    expect(formatKitSummary({ shirt: "#123456", shorts: "#111310" })).toEqual("自定义衣 · 黑裤");
  });
});
