import { ref, watch, type Ref } from "vue";
import { hasSeenHomeOnboardingTour, markHomeOnboardingTourSeen } from "@/utils/onboardingTourStorage";

interface HomeOnboardingTourOptions {
  userId: Readonly<Ref<number | null>>;
  ready: Readonly<Ref<boolean>>;
  pageVisible: Readonly<Ref<boolean>>;
  skipAutomatic: Readonly<Ref<boolean>>;
  errorMessage: Readonly<Ref<string>>;
}

/** 首次漫游独立于首页常驻指引的收起状态；账号切换/页面隐藏均清除当前遮罩。 */
export function useHomeOnboardingTour(options: HomeOnboardingTourOptions) {
  const active = ref(false);
  const replayPending = ref(false);
  const attempted = new Set<number | null>();
  let owner: number | null = options.userId.value;

  const stopWatch = watch(
    [options.userId, options.ready, options.pageVisible, options.skipAutomatic, replayPending, options.errorMessage],
    ([userId, ready, visible, skipAutomatic, , errorMessage]) => {
      if (owner !== userId || !ready || !visible || errorMessage) active.value = false;
      owner = userId;
      if (!ready || !visible || errorMessage || active.value) return;
      if (!replayPending.value && (skipAutomatic || attempted.has(userId) || hasSeenHomeOnboardingTour(userId))) return;
      attempted.add(userId);
      active.value = true;
      replayPending.value = false;
    },
    { immediate: true, flush: "sync" },
  );

  function requestReplay(): void { if (!active.value) replayPending.value = true; }
  function stop(): void { active.value = false; }
  function finish(): void {
    if (active.value) markHomeOnboardingTourSeen(owner);
    stop();
  }
  function dispose(): void { stopWatch(); stop(); }

  return { active, requestReplay, finish, stop, dispose };
}
