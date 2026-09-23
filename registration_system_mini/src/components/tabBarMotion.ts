import { shallowRef } from "vue";

export type TabKey = "home" | "challenge" | "stats" | "mine";
type TabMotion = { id: number; from: TabKey; to: TabKey };

// 每个 tab 页面有独立底栏；在目标页 onShow 时交接动效，避免为动画延迟路由。
export function createTabBarMotion() {
  const active = shallowRef<TabMotion | null>(null);
  let pending: TabMotion | null = null;
  let sequence = 0;
  return {
    active,
    prepare(from: TabKey, to: TabKey) {
      const motion = { id: ++sequence, from, to };
      pending = motion;
      return motion.id;
    },
    show(tab: TabKey) {
      active.value = pending?.to === tab ? pending : null;
      pending = null;
    },
    cancel(id: number) {
      if (pending?.id === id) pending = null;
    },
  };
}

export const tabBarMotion = createTabBarMotion();

export function tabIndicatorTransform(tab: TabKey, hasCreateEntry: boolean): string {
  const index = ["home", "challenge", "stats", "mine"].indexOf(tab);
  const centerGap = hasCreateEntry && index >= 2 ? " + 132rpx" : "";
  return `translateX(calc(${index * 100}%${centerGap}))`;
}
