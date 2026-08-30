import { JSDOM } from "jsdom";

// Node 26 + vitest 的 jsdom 环境下 window.localStorage getter 丢失绑定返回 undefined；
// 从独立 JSDOM 实例借用同源 Storage 挂回，保证 token-storage 等模块可用。
if (typeof window !== "undefined" && window.localStorage == null) {
  const donor = new JSDOM("<!DOCTYPE html>", { url: "http://localhost:8000/" });
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: donor.window.localStorage,
  });
}
