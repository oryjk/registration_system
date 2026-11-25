import { computed, getCurrentScope, nextTick, onScopeDispose, ref, watch, type ComputedRef, type Ref } from "vue";
import { onUnload } from "@dcloudio/uni-app";
import type { HomeMatchCardViewModel, TeamProfileViewModel } from "@/types/viewModels";
import {
  HOME_SHARE_CARD_CANVAS_ID,
  MAX_HOME_SHARE_AVATARS,
  buildHomeShareTitle,
  composeHomeShareCard,
  createHomeShareImageLoader,
  type HomeShareCardInput,
} from "@/utils/homeShareCardCompose";

type MaybeReadonlyRef<T> = Ref<T> | ComputedRef<T>;

export interface UseHomeShareCardOptions {
  /** 当前页面组件实例（通常在 setup 中传入 getCurrentInstance()） */
  pageInstance: unknown;
  /** 首页首轮数据是否已加载完成（避免加载中途反复绘制游客态与球队态） */
  ready: MaybeReadonlyRef<boolean>;
  /** 是否游客态 */
  isGuestMode: MaybeReadonlyRef<boolean>;
  /** 当前用户昵称 */
  inviterName: MaybeReadonlyRef<string>;
  /** 当前球队资料 */
  currentTeam: MaybeReadonlyRef<TeamProfileViewModel | null>;
  /** 首页即将开赛列表 */
  upcomingMatches: MaybeReadonlyRef<HomeMatchCardViewModel[]>;
  /** 首页焦点下一场比赛 */
  heroNextMatch: MaybeReadonlyRef<HomeMatchCardViewModel | null>;
  /** 合成未就绪或失败时的同步回落图（通常来自 useShareCover("home").shareImageUrl） */
  fallbackImageUrl: MaybeReadonlyRef<string>;
  /** 隐藏 canvas 的 id，默认 home-share-card-canvas */
  canvasId?: string;
}

function formatNextMatchDateLabel(match: HomeMatchCardViewModel): string {
  const block = match.dateBlock;
  const compact = [block?.weekday, block?.timeLabel].filter(Boolean).join(" ").trim();
  if (compact) return compact;
  return match.dateLabel || "";
}

/**
 * 仅在微信小程序端驱动隐藏 `<canvas type="2d">` 异步合成首页 5:4 社交分享卡（方案 A：球队召集令）；
 * H5 端始终直接回落 fallbackImageUrl，保持既有分享行为不变。
 */
export function useHomeShareCard(options: UseHomeShareCardOptions) {
  const canvasId = options.canvasId || HOME_SHARE_CARD_CANVAS_ID;
  const composedImageUrl = ref("");
  const composedKey = ref("");

  let renderVersion = 0;
  let disposed = false;
  let lastQueuedKey = "";
  let renderQueue: Promise<unknown> = Promise.resolve();
  const imageLoader = createHomeShareImageLoader();

  const cardInput = computed<HomeShareCardInput>(() => {
    if (options.isGuestMode.value) {
      return {};
    }
    const team = options.currentTeam.value;
    const next = options.heroNextMatch.value;
    return {
      inviterName: options.inviterName.value,
      teamName: team?.name || "",
      teamLogoUrl: team?.logoUrl || "",
      teamMemberCount: team?.memberCount ?? 0,
      teamCreditScore: team?.creditScore ?? 0,
      upcomingMatchCount: options.upcomingMatches.value.length,
      nextMatch: next
        ? {
            title: next.title,
            dateLabel: formatNextMatchDateLabel(next),
            venue: next.venue,
            joinedPlayers: next.joinedPlayers,
            requiredPlayers: next.requiredPlayers,
            avatars: next.participantAvatars.slice(0, MAX_HOME_SHARE_AVATARS).map((item) => ({
              name: item.displayText,
              avatarUrl: item.avatarUrl,
              tone: item.tone,
            })),
          }
        : null,
    };
  });

  const shareTitle = computed(() => buildHomeShareTitle(cardInput.value));

  const renderKey = computed(() => {
    if (!options.ready.value) return "";
    const input = cardInput.value;
    return JSON.stringify([
      input.inviterName ?? "",
      input.teamName ?? "",
      input.teamLogoUrl ?? "",
      input.teamMemberCount ?? 0,
      input.teamCreditScore ?? 0,
      input.upcomingMatchCount ?? 0,
      input.nextMatch
        ? [
            input.nextMatch.title,
            input.nextMatch.dateLabel ?? "",
            input.nextMatch.venue ?? "",
            input.nextMatch.joinedPlayers,
            input.nextMatch.avatars.map((a) => [a.name, a.avatarUrl ?? "", a.tone ?? ""]),
          ]
        : null,
    ]);
  });

  const shareCardImageUrl = computed(() => {
    // #ifdef MP-WEIXIN
    if (composedImageUrl.value && composedKey.value === renderKey.value) {
      return composedImageUrl.value;
    }
    // #endif
    return options.fallbackImageUrl.value;
  });

  function enqueue<T>(action: () => Promise<T>): Promise<T> {
    const task = renderQueue.catch(() => undefined).then(action);
    renderQueue = task;
    return task;
  }

  function resetComposedState() {
    renderVersion++;
    lastQueuedKey = "";
    composedImageUrl.value = "";
    composedKey.value = "";
  }

  async function refreshHomeShareCard(refreshOptions?: { force?: boolean }): Promise<void> {
    if (disposed) return;
    const key = renderKey.value;
    if (!key) {
      resetComposedState();
      return;
    }

    // #ifdef MP-WEIXIN
    const force = !!refreshOptions?.force;
    if (!force && (key === lastQueuedKey || (key === composedKey.value && composedImageUrl.value))) {
      return;
    }

    const version = ++renderVersion;
    const currentInput = cardInput.value;
    const snapshotInput: HomeShareCardInput = {
      ...currentInput,
      nextMatch: currentInput.nextMatch
        ? {
            ...currentInput.nextMatch,
            avatars: currentInput.nextMatch.avatars.map((item) => ({ ...item })),
          }
        : null,
    };
    lastQueuedKey = key;

    try {
      await nextTick();
      if (disposed || version !== renderVersion) return;

      const path = await enqueue(() =>
        composeHomeShareCard(
          canvasId,
          options.pageInstance,
          snapshotInput,
          () => !disposed && version === renderVersion && renderKey.value === key,
          imageLoader.load,
        ),
      );
      if (!disposed && version === renderVersion && renderKey.value === key) {
        composedImageUrl.value = path;
        composedKey.value = key;
      }
    } catch {
      if (version === renderVersion && lastQueuedKey === key) {
        lastQueuedKey = "";
      }
    }
    // #endif
  }

  function cleanup() {
    if (disposed) return;
    disposed = true;
    renderVersion++;
    lastQueuedKey = "";
    imageLoader.clear();
  }

  // #ifdef MP-WEIXIN
  watch(
    renderKey,
    (nextKey) => {
      if (!nextKey) {
        resetComposedState();
        return;
      }
      void refreshHomeShareCard();
    },
    { immediate: true },
  );
  // #endif

  if (getCurrentScope()) {
    onScopeDispose(cleanup);
  }
  onUnload(cleanup);

  return {
    canvasId,
    shareTitle,
    shareCardImageUrl,
    refreshHomeShareCard,
  };
}
