import { ref, watch, type Ref } from "vue";
import {
  hasSeenHomeOnboardingTour, markHomeOnboardingTourSeen,
  isHomeOnboardingTourPermanentlySkipped, permanentlySkipHomeOnboardingTour,
} from "@/utils/onboardingTourStorage";

interface HomeOnboardingTourOptions {
  userId: Readonly<Ref<number | null>>;
  ready: Readonly<Ref<boolean>>;
  pageVisible: Readonly<Ref<boolean>>;
  skipAutomatic: Readonly<Ref<boolean>>;
  errorMessage: Readonly<Ref<string>>;
  /** 仅微信端启用；无球队用户每次 App 进入都需引导，除非明确永久跳过。 */
  repeatWithoutTeam?: Readonly<Ref<boolean>>;
  entryVersion?: Readonly<Ref<number>>;
}

/** 首次漫游独立于首页常驻指引的收起状态；账号切换/页面隐藏均清除当前遮罩。 */
export function useHomeOnboardingTour(options: HomeOnboardingTourOptions) {
  const active = ref(false);
  const confirmingSkip = ref(false);
  const replayPending = ref(false);
  const attempted = new Set<number | null>();
  let owner: number | null = options.userId.value;
  const repeatWithoutTeam = options.repeatWithoutTeam ?? ref(false);
  const entryVersion = options.entryVersion ?? ref(0);
  let observedEntry = entryVersion.value;
  let previousSkipAutomatic = options.skipAutomatic.value;
  let shareEntry = previousSkipAutomatic ? entryVersion.value : null;

  const stopWatch = watch(
    [options.userId, options.ready, options.pageVisible, options.skipAutomatic, replayPending, options.errorMessage, repeatWithoutTeam, entryVersion],
    ([userId, ready, visible, skipAutomatic, , errorMessage, repeat, entry]) => {
      if (skipAutomatic && !previousSkipAutomatic) shareEntry = entry;
      previousSkipAutomatic = skipAutomatic;
      const newEntry = entry !== observedEntry;
      if (newEntry) { observedEntry = entry; attempted.clear(); }
      if (owner !== userId || !ready || !visible || errorMessage || newEntry) stop();
      owner = userId;
      if (!ready || !visible || errorMessage || active.value) return;
      const permanentlySkipped = !!options.repeatWithoutTeam && isHomeOnboardingTourPermanentlySkipped(userId);
      const alreadySeen = !repeat && hasSeenHomeOnboardingTour(userId);
      const deferForShare = skipAutomatic && (!options.entryVersion || shareEntry === entry);
      if (!replayPending.value && (deferForShare || attempted.has(userId) || permanentlySkipped || alreadySeen)) return;
      attempted.add(userId);
      active.value = true;
      replayPending.value = false;
    },
    // App onShow 与首页 onShow 的刷新编排结束后再判定，避免用上次缓存的 ready 抢先启动。
    { immediate: true, flush: "post" },
  );

  function requestReplay(): void { if (!active.value) replayPending.value = true; }
  function stop(): void { active.value = false; confirmingSkip.value = false; }
  function finish(): void {
    // 「看过」仍供已有球队/H5 使用；无球队的重复策略只认独立的永久跳过标记。
    if (active.value) markHomeOnboardingTourSeen(owner);
    stop();
  }
  function requestSkip(): void {
    if (!active.value) return;
    if (repeatWithoutTeam.value) confirmingSkip.value = true;
    else finish();
  }
  function cancelSkip(): void { confirmingSkip.value = false; }
  function skipOnce(): void { if (active.value && confirmingSkip.value) stop(); }
  function skipPermanently(): void {
    if (!active.value || !confirmingSkip.value) return;
    permanentlySkipHomeOnboardingTour(owner);
    stop();
  }
  function dispose(): void { stopWatch(); stop(); }

  return { active, confirmingSkip, requestReplay, requestSkip, cancelSkip, skipOnce, skipPermanently, finish, stop, dispose };
}
