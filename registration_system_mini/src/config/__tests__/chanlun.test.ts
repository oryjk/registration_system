import { describe, expect, test } from "bun:test";
import { buildChanlunUrl, sanitizeChanlunReturnQuery } from "../chanlun";

const BASE = "https://match.oryjk.cn/chanlun/";

describe("缠观入口地址", () => {
  test("合法回跳参数拼到缠观地址", () => {
    expect(buildChanlunUrl("secid=1.600519&timeframe=30m", BASE)).toEqual(
      "https://match.oryjk.cn/chanlun/?secid=1.600519&timeframe=30m",
    );
    expect(buildChanlunUrl("?view=rankings", BASE)).toEqual("https://match.oryjk.cn/chanlun/?view=rankings");
  });

  test("缺省或非法回跳参数回到缠观首页", () => {
    expect(buildChanlunUrl(undefined, BASE)).toEqual(BASE);
    expect(buildChanlunUrl("", BASE)).toEqual(BASE);
    expect(buildChanlunUrl("https://evil.test", BASE)).toEqual(BASE);
    expect(buildChanlunUrl("a=1#frag", BASE)).toEqual(BASE);
    expect(sanitizeChanlunReturnQuery("x".repeat(600))).toEqual("");
  });
});
