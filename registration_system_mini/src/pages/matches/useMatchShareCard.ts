import { computed, getCurrentScope, nextTick, onScopeDispose, ref, watch, type ComputedRef, type Ref } from "vue";
import { onUnload } from "@dcloudio/uni-app";
import { DEFAULT_MATCH_COVER_URL } from "@/config/matchCover";
import type { BackendActivity } from "@/types/backend";
import {
  MATCH_SHARE_CARD_CANVAS_ID,
  composeMatchShareCard,
  createMatchShareImageLoader,
  type MatchShareCardInput,
} from "@/utils/matchShareCardCompose";

type MaybeReadonlyRef<T> = Ref<T> | ComputedRef<T>;

export interface UseMatchShareCardOptions {
  /** 当前页面组件实例（通常在 setup 中传入 getCurrentInstance()?.proxy） */
  pageInstance: unknown;
  /** 比赛详情对象；未加载时为 null */
  match: MaybeReadonlyRef<BackendActivity | null>;
  /** 比赛类型标签，如「线下已约」「散人约球」 */
  matchKindLabel: MaybeReadonlyRef<string>;
  /** 主队名称 */
  homeTeamLabel: MaybeReadonlyRef<string>;
  /** 对手名称 */
  displayOpponentLabel: MaybeReadonlyRef<string>;
  /** 主队球衣颜色 */
  homeTeamColor: MaybeReadonlyRef<string>;
  /** 客队/对手球衣颜色 */
  awayTeamColor: MaybeReadonlyRef<string>;
  /** 开始时间钟点兜底文案 */
  matchClockLabel: MaybeReadonlyRef<string>;
  /** 比赛地点 */
  matchLocation: MaybeReadonlyRef<string>;
  /** 是否为散人约球 */
  isPickupMatch?: MaybeReadonlyRef<boolean>;
  /** 是否为场馆组局 */
  isVenueMatch?: MaybeReadonlyRef<boolean>;
  /** 合成未就绪或失败时的同步回落图（通常来自 useShareCover("match").shareImageUrl） */
  fallbackImageUrl: MaybeReadonlyRef<string>;
  /** 隐藏 canvas 的 id / canvas-id，默认 match-share-card-canvas */
  canvasId?: string;
}

/**
 * 仅在微信小程序端驱动隐藏 canvas 异步合成 5:4 比赛信息分享卡；
 * H5 端始终直接回落 fallbackImageUrl，保持既有分享行为不变。
 */
export function useMatchShareCard(options: UseMatchShareCardOptions) {
  const canvasId = options.canvasId || MATCH_SHARE_CARD_CANVAS_ID;
  const composedImageUrl = ref("");
  const composedKey = ref("");

  let renderVersion = 0;
  let disposed = false;
  let lastQueuedKey = "";
  let renderQueue: Promise<unknown> = Promise.resolve();
  const imageLoader = createMatchShareImageLoader();

  const cardInput = computed<MatchShareCardInput | null>(() => {
    const current = options.match.value;
    if (!current) return null;
    return {
      name: current.name,
      matchKindLabel: options.matchKindLabel.value,
      homeTeamLabel: options.homeTeamLabel.value,
      opponentLabel: options.displayOpponentLabel.value,
      homeTeamColor: options.homeTeamColor.value,
      awayTeamColor: options.awayTeamColor.value,
      startTime: current.start_time || current.holding_date,
      endTime: current.end_time,
      clockFallback: options.matchClockLabel.value,
      location: options.matchLocation.value || current.location,
      isPickupMatch: options.isPickupMatch?.value ?? false,
      isVenueMatch: options.isVenueMatch?.value ?? false,
      playersPerTeam: current.players_per_team,
    };
  });

  const backgroundCandidates = computed<string[]>(() => {
    const candidates: string[] = [];
    const customCover = options.match.value?.cover?.trim() || "";
    if (customCover && customCover !== DEFAULT_MATCH_COVER_URL) {
      candidates.push(customCover);
    }
    const fallback = options.fallbackImageUrl.value?.trim() || "";
    if (fallback && !candidates.includes(fallback)) {
      candidates.push(fallback);
    }
    return candidates;
  });

  const renderKey = computed(() => {
    const current = options.match.value;
    const input = cardInput.value;
    if (!current || !input) return "";
    return JSON.stringify([
      current.id,
      input.name,
      input.matchKindLabel,
      input.homeTeamLabel,
      input.opponentLabel,
      input.homeTeamColor,
      input.awayTeamColor,
      input.startTime,
      input.endTime,
      input.clockFallback,
      input.location,
      input.isPickupMatch,
      input.isVenueMatch,
      input.playersPerTeam ?? null,
      backgroundCandidates.value,
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

  async function refreshShareCard(refreshOptions?: { force?: boolean }): Promise<void> {
    if (disposed) return;
    const input = cardInput.value;
    const key = renderKey.value;
    if (!input || !key) {
      resetComposedState();
      return;
    }

    // H5 无微信原生转发卡片，保留既有静态封面回落逻辑，不触碰隐藏 canvas。
    // #ifdef MP-WEIXIN
    const force = !!refreshOptions?.force;
    if (!force && (key === lastQueuedKey || (key === composedKey.value && composedImageUrl.value))) {
      return;
    }

    const version = ++renderVersion;
    const snapshotInput: MatchShareCardInput = { ...input };
    const snapshotBackgrounds = [...backgroundCandidates.value];
    lastQueuedKey = key;

    try {
      await nextTick();
      if (disposed || version !== renderVersion) return;

      const path = await enqueue(() =>
        composeMatchShareCard(
          canvasId,
          options.pageInstance,
          snapshotInput,
          snapshotBackgrounds,
          () => !disposed && version === renderVersion && renderKey.value === key,
          imageLoader.load,
        ),
      );
      if (!disposed && version === renderVersion && renderKey.value === key) {
        composedImageUrl.value = path;
        composedKey.value = key;
      }
    } catch {
      // 合成失败时静默保持 fallbackImageUrl，同时清除去重标记以便下次重试。
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
      void refreshShareCard();
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
    shareCardImageUrl,
    refreshShareCard,
  };
}
