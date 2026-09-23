import { ref } from "vue";
import type { InjectionKey, Ref } from "vue";

/**
 * 页面级滚动容器控制接口。
 * 采用 scroll-view 滚动架构的页面在自身 setup 中 provide 实现
 * （AppTabHeader 与滚动容器是兄弟节点，provide 必须来自页面根），
 * 未注入的页面回落原生页面滚动。
 */
export interface AppScrollController {
  scrollToTop(): void;
}

export const APP_SCROLL_CONTROLLER: InjectionKey<AppScrollController> = Symbol("app-scroll-controller");

/**
 * 页面滚动锚点：anchor 绑到 AppPullScrollView 的模板 ref 上，
 * controller 通过 provide 传给页面组件树（如 AppTabHeader 双击回顶）。
 */
export function createAppScrollAnchor() {
  const anchor: Ref<AppScrollController | null> = ref(null);
  const controller: AppScrollController = {
    scrollToTop: () => anchor.value?.scrollToTop(),
  };
  return { anchor, controller };
}
