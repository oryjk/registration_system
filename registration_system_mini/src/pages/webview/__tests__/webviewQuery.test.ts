import { describe, expect, test } from "bun:test";
import { readWebViewPageQuery } from "../webviewQuery";

describe("web-view 路由参数", () => {
  test("微信路由解码 URL 和中文标题", () => {
    const url = "https://match.oryjk.cn/chanlun/?webview_code=one-time-code&webview_identity_kind=venue";
    expect(readWebViewPageQuery({ url: encodeURIComponent(url), title: encodeURIComponent("缠观") }, true))
      .toEqual({ url, title: "缠观" });
  });

  test("只解码路由这一层，保留目标 URL 内的编码和参数边界", () => {
    const url = "https://match.oryjk.cn/chanlun/?name=A%26B%20C&percent=50%25#section%201";
    expect(readWebViewPageQuery({ url: encodeURIComponent(url) }, true)).toEqual({ url, title: "" });
  });

  test("H5 已解码的 URL 和标题保持原值", () => {
    const url = "https://match.oryjk.cn/chanlun/?name=A%26B&percent=50%25";
    expect(readWebViewPageQuery({ url, title: "缠观 50%" })).toEqual({ url, title: "缠观 50%" });
  });

  test("缺失、非字符串和损坏的微信编码返回空值，不抛异常", () => {
    for (const query of [undefined, {}, { url: 123, title: null }, { url: "%E7%BC", title: "%" }]) {
      expect(readWebViewPageQuery(query, true)).toEqual({ url: "", title: "" });
    }
  });
});
