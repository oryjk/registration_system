import { describe, expect, test } from "bun:test";
import { compile } from "@vue/compiler-dom";
import * as Vue from "vue";
import { sourcePath } from "@/test/sourcePaths";

declare const Bun: { file(path: string): { text(): Promise<string> } };
const source = await Bun.file(sourcePath("pages/user/index.vue")).text();
const button = source.match(/<button\b[^>]*@tap="openChanlun"[^>]*>[\s\S]*?<\/button>/)?.[0];
if (!button) throw new Error("缠观入口未找到");
const render = new Function("Vue", compile(button, { mode: "function" }).code)({
  ...Vue,
  resolveComponent: () => "icon",
});

describe("缠观审核入口", () => {
  test("审核策略要求隐藏时不渲染入口，状态改变后恢复", () => {
    for (const hidden of [true, false, true]) {
      const node = render({ shouldHideCreationEntrances: hidden, openChanlun() {} }, []);
      expect(node.type).toEqual(hidden ? Vue.Comment : "button");
    }
  });

  test("审核策略要求隐藏时，迟到的点击也不发起导航", () => {
    const body = source.match(/function openChanlun\(\) \{([\s\S]*?)\n\}/)?.[1];
    if (!body) throw new Error("缠观导航未找到");
    const paths: string[] = [];
    const hidden = Vue.ref(true);
    const tap = new Function("shouldHideCreationEntrances", "uni", body);
    const navigation = { navigateTo: ({ url }: { url: string }) => paths.push(url) };
    tap(hidden, navigation);
    expect(paths).toEqual([]);
    hidden.value = false;
    tap(hidden, navigation);
    expect(paths).toEqual(["/pages/chanlun/index"]);
  });
});
