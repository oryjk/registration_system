import { describe, expect, test } from "bun:test";
import { miniPath } from "@/test/sourcePaths";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

async function read(path: string) {
  return Bun.file(miniPath(path)).text();
}

describe("NeoButton event chain", () => {
  test("emits click only from the inner control so one tap cannot emit twice", async () => {
    const source = await read("src/components/neo/NeoButton.vue");

    // 外层 view 只负责视觉与按压反馈；click 唯一入口是内层 wd-button，
    // 外层再绑 click 会在 stopPropagation=false 时同一次点击 emit 两次。
    const viewOpen = source.indexOf(':hover-class="hoverClass"');
    const innerOpen = source.indexOf("<wd-button");
    expect(viewOpen > 0).toEqual(true);
    expect(innerOpen > viewOpen).toEqual(true);
    expect(source.slice(viewOpen, innerOpen).includes("@click")).toEqual(false);
    expect(source.includes('@click="handleClick"')).toEqual(true);
    expect(source.includes('(event: "click"): void')).toEqual(true);
  });

  test("binds call sites with the declared click event instead of tap", async () => {
    const hall = await read("src/pages/activities/index.vue");
    const applyTeam = await read("src/pages/matches/apply-team/components/ApplyTeamStatusCard.vue");

    // NeoButton 只声明 click；@tap 在小程序端收不到组件 emit，游客登录/撤回/去报名都会失效。
    expect(hall.includes('@tap="handleLogin"')).toEqual(false);
    expect(hall.includes('@click="handleLogin"')).toEqual(true);
    expect(applyTeam.includes(`@tap="emit('withdraw')"`)).toEqual(false);
    expect(applyTeam.includes(`@click="emit('withdraw')"`)).toEqual(true);
    expect(applyTeam.includes(`@tap="emit('goMatch')"`)).toEqual(false);
    expect(applyTeam.includes(`@click="emit('goMatch')"`)).toEqual(true);
  });
});
