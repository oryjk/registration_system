import { getCurrentInstance, onUnmounted, ref, watch, type Ref } from "vue";

export interface OverlayPresenceOptions {
  /**
   * 退场动画时长（ms），需与 `--ui-motion-overlay-duration` 的实际值保持一致。
   * 传 0 表示无退场（如 H5 减少动态效果），立即从 DOM 移除。
   * 可传函数在**关闭时刻**求值：系统"减少动态效果"运行中切换后，JS 移除时延
   * 与 CSS 媒体查询的实时状态保持同步。
   */
  leaveDurationMs?: number | (() => number);
  /** 调度器注入，供行为测试手动推进时间；默认 setTimeout/clearTimeout。 */
  schedule?: (callback: () => void, ms: number) => number;
  cancel?: (id: number) => void;
}

/**
 * 弹层进出场时序：visible 变 false 时先保留 DOM 播放退场动画并维持遮罩拦截，
 * 动画结束后再移除；期间重新打开会取消未决的移除回调，旧回调也不会误关新弹层。
 * 组件卸载时清理未决定时器，迟到回调不改变新页面状态。
 */
export function useOverlayPresence(visible: Ref<boolean>, options: OverlayPresenceOptions = {}) {
  const schedule = options.schedule ?? ((callback: () => void, ms: number) => setTimeout(callback, ms) as unknown as number);
  const cancel = options.cancel ?? ((id: number) => clearTimeout(id));

  function resolveLeaveDurationMs(): number {
    if (typeof options.leaveDurationMs === "function") return options.leaveDurationMs();
    return options.leaveDurationMs ?? 210;
  }

  const rendered = ref(visible.value);
  const leaving = ref(false);
  let leaveTimer = 0;

  function finishLeave() {
    leaveTimer = 0;
    // 只有仍然是关闭态才真正移除：防止迟到回调误关已重新打开的弹层。
    if (!visible.value) {
      rendered.value = false;
      leaving.value = false;
    }
  }

  watch(visible, (value) => {
    if (value) {
      cancel(leaveTimer);
      leaveTimer = 0;
      leaving.value = false;
      rendered.value = true;
      return;
    }
    if (!rendered.value || leaving.value) return;
    // 关闭时刻求值退场时长：reduce 设置切换后立即生效，与 CSS 媒体查询同步。
    const leaveDurationMs = resolveLeaveDurationMs();
    if (leaveDurationMs <= 0) {
      rendered.value = false;
      return;
    }
    leaving.value = true;
    leaveTimer = schedule(finishLeave, leaveDurationMs);
  });

  function dispose() {
    cancel(leaveTimer);
    leaveTimer = 0;
  }

  if (getCurrentInstance()) {
    onUnmounted(dispose);
  }

  return { rendered, leaving, dispose };
}
