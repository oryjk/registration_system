import { describe, expect, test } from "bun:test";
import { nextTick, ref } from "vue";
import { useOverlayPresence } from "@/components/ui/useOverlayPresence";

/** 手动时钟：记录调度任务，可推进时间或强制触发（模拟迟到回调）。 */
function createManualClock() {
  interface Task { id: number; at: number; cancelled: boolean; fire: () => void }
  const tasks: Task[] = [];
  let nextId = 1;
  let now = 0;
  return {
    schedule: (callback: () => void, ms: number) => {
      const task: Task = { id: nextId++, at: now + ms, cancelled: false, fire: callback };
      tasks.push(task);
      return task.id;
    },
    cancel: (id: number) => {
      const task = tasks.find((item) => item.id === id);
      if (task) task.cancelled = true;
    },
    advance: (ms: number) => {
      now += ms;
      for (const task of [...tasks]) {
        if (!task.cancelled && task.at <= now) task.fire();
      }
    },
    fireById: (id: number) => {
      tasks.find((item) => item.id === id)?.fire();
    },
    pendingIds: () => tasks.filter((item) => !item.cancelled).map((item) => item.id),
  };
}

function setup(leaveDurationMs = 210) {
  const visible = ref(false);
  const clock = createManualClock();
  const presence = useOverlayPresence(visible, {
    leaveDurationMs,
    schedule: clock.schedule,
    cancel: clock.cancel,
  });
  return { visible, clock, presence };
}

describe("overlay presence close timing", () => {
  test("closing keeps the overlay mounted and intercepting during the exit window, then removes it", async () => {
    const { visible, clock, presence } = setup();
    visible.value = true;
    await nextTick();
    expect(presence.rendered.value).toEqual(true);

    visible.value = false;
    await nextTick();
    // 退场窗口内仍在 DOM（遮罩继续拦截点击）。
    expect(presence.rendered.value).toEqual(true);
    expect(presence.leaving.value).toEqual(true);

    clock.advance(210);
    expect(presence.rendered.value).toEqual(false);
    expect(presence.leaving.value).toEqual(false);
  });

  test("rapid close then reopen cancels the pending removal and the overlay stays visible", async () => {
    const { visible, clock, presence } = setup();
    visible.value = true;
    await nextTick();
    visible.value = false;
    await nextTick();
    expect(presence.leaving.value).toEqual(true);

    visible.value = true;
    await nextTick();
    expect(presence.rendered.value).toEqual(true);
    expect(presence.leaving.value).toEqual(false);

    clock.advance(500);
    expect(presence.rendered.value).toEqual(true);
    expect(clock.pendingIds()).toEqual([]);
  });

  test("a stale leave callback cannot hide a reopened overlay", async () => {
    const { visible, clock, presence } = setup();
    visible.value = true;
    await nextTick();
    visible.value = false;
    await nextTick();
    const pending = clock.pendingIds();
    expect(pending.length).toEqual(1);

    visible.value = true;
    await nextTick();
    // 即使取消失效、旧回调照常触发，也不能误关已重新打开的弹层。
    clock.fireById(pending[0]!);
    expect(presence.rendered.value).toEqual(true);
    expect(presence.leaving.value).toEqual(false);
  });

  test("dispose cancels pending removal so late callbacks never fire after unmount", async () => {
    const { visible, clock, presence } = setup();
    visible.value = true;
    await nextTick();
    visible.value = false;
    await nextTick();
    expect(clock.pendingIds().length).toEqual(1);

    presence.dispose();
    expect(clock.pendingIds()).toEqual([]);
    clock.advance(1000);
    // 卸载后状态不再被迟到回调改变（此处仍为退场中的最后已知状态，无新副作用）。
    expect(clock.pendingIds()).toEqual([]);
  });

  test("zero leave duration removes the overlay immediately for reduced-motion users", async () => {
    const { visible, presence } = setup(0);
    visible.value = true;
    await nextTick();
    expect(presence.rendered.value).toEqual(true);

    visible.value = false;
    await nextTick();
    expect(presence.rendered.value).toEqual(false);
    expect(presence.leaving.value).toEqual(false);
  });

  test("a function duration is resolved at close time so mid-session settings switches take effect", async () => {
    // 模拟系统设置：打开弹窗时未开"减少动态效果"，关闭前用户打开了它。
    let reducedMotionEnabled = false;
    const visible = ref(false);
    const clock = createManualClock();
    const presence = useOverlayPresence(visible, {
      leaveDurationMs: () => reducedMotionEnabled ? 0 : 210,
      schedule: clock.schedule,
      cancel: clock.cancel,
    });

    visible.value = true;
    await nextTick();
    reducedMotionEnabled = true;
    visible.value = false;
    await nextTick();
    // 关闭时刻读到 reduce：立即移除，无退场窗口、无幽灵拦截。
    expect(presence.rendered.value).toEqual(false);
    expect(presence.leaving.value).toEqual(false);
    expect(clock.pendingIds()).toEqual([]);
  });

  test("re-enabling motion before close restores the full exit window", async () => {
    // 反向切换：打开时是 reduce，关闭前用户关闭了 reduce → 走完整退场时序。
    let reducedMotionEnabled = true;
    const visible = ref(false);
    const clock = createManualClock();
    const presence = useOverlayPresence(visible, {
      leaveDurationMs: () => reducedMotionEnabled ? 0 : 210,
      schedule: clock.schedule,
      cancel: clock.cancel,
    });

    visible.value = true;
    await nextTick();
    reducedMotionEnabled = false;
    visible.value = false;
    await nextTick();
    expect(presence.leaving.value).toEqual(true);
    expect(presence.rendered.value).toEqual(true);

    clock.advance(210);
    expect(presence.rendered.value).toEqual(false);
  });

  test("initially visible overlays render without a leave state", () => {
    const visible = ref(true);
    const presence = useOverlayPresence(visible, { schedule: createManualClock().schedule, cancel: createManualClock().cancel });
    expect(presence.rendered.value).toEqual(true);
    expect(presence.leaving.value).toEqual(false);
  });
});
