import { computed, getCurrentScope, nextTick, onScopeDispose, ref, watch, type ComputedRef, type Ref } from "vue";
import { onUnload } from "@dcloudio/uni-app";
import type { BackendActivity } from "@/types/backend";
import {
  MATCH_SHARE_CARD_CANVAS_ID,
  MAX_DUAL_REGISTRATION_AVATARS,
  MAX_SINGLE_REGISTRATION_AVATARS,
  composeMatchShareCard,
  createMatchShareImageLoader,
  type MatchShareCardInput,
  type MatchShareRegistrationGroup,
  type MatchShareRegistrationInput,
} from "@/utils/matchShareCardCompose";

type MaybeReadonlyRef<T> = Ref<T> | ComputedRef<T>;

function serializeRegistrationGroupKey(group: MatchShareRegistrationGroup, limit: number) {
  return [
    group.label ?? "",
    group.joinedCount,
    group.requiredCount ?? null,
    group.avatars.slice(0, limit).map((item) => [item.name, item.avatarUrl ?? "", item.tone ?? ""]),
  ];
}

function serializeRegistrationKey(registration?: MatchShareRegistrationInput | null) {
  if (!registration) return null;
  if (registration.mode === "dual") {
    return [
      "dual",
      serializeRegistrationGroupKey(registration.home, MAX_DUAL_REGISTRATION_AVATARS),
      serializeRegistrationGroupKey(registration.away, MAX_DUAL_REGISTRATION_AVATARS),
    ];
  }
  return [
    "single",
    serializeRegistrationGroupKey(registration.group, MAX_SINGLE_REGISTRATION_AVATARS),
  ];
}

function cloneRegistrationGroup(group: MatchShareRegistrationGroup): MatchShareRegistrationGroup {
  return {
    label: group.label,
    joinedCount: group.joinedCount,
    requiredCount: group.requiredCount,
    avatars: group.avatars.map((item) => ({
      name: item.name,
      avatarUrl: item.avatarUrl,
      tone: item.tone,
    })),
  };
}

function cloneRegistrationInput(
  registration?: MatchShareRegistrationInput | null,
): MatchShareRegistrationInput | null {
  if (!registration) return null;
  if (registration.mode === "dual") {
    return {
      mode: "dual",
      home: cloneRegistrationGroup(registration.home),
      away: cloneRegistrationGroup(registration.away),
    };
  }
  return {
    mode: "single",
    group: cloneRegistrationGroup(registration.group),
  };
}

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
  /** 主队上衣颜色 */
  homeTeamColor: MaybeReadonlyRef<string>;
  /** 主队球裤颜色（可选） */
  homeShortsColor?: MaybeReadonlyRef<string>;
  /** 主队球袜颜色（可选） */
  homeSocksColor?: MaybeReadonlyRef<string>;
  /** 客队/对手上衣颜色 */
  awayTeamColor: MaybeReadonlyRef<string>;
  /** 客队/对手球裤颜色（可选） */
  awayShortsColor?: MaybeReadonlyRef<string>;
  /** 客队/对手球袜颜色（可选） */
  awaySocksColor?: MaybeReadonlyRef<string>;
  /** 自定义上传的比赛分享背景图 URL（可选，通常传 sourceMatch?.share_bg_image_url） */
  customBgImageUrl?: MaybeReadonlyRef<string>;
  /** 开始时间钟点兜底文案 */
  matchClockLabel: MaybeReadonlyRef<string>;
  /** 比赛地点 */
  matchLocation: MaybeReadonlyRef<string>;
  /** 是否为散人约球 */
  isPickupMatch?: MaybeReadonlyRef<boolean>;
  /** 是否为场馆组局 */
  isVenueMatch?: MaybeReadonlyRef<boolean>;
  /** 实时报名进度与头像数据（方案 A 独立大头像报名条） */
  registration?: MaybeReadonlyRef<MatchShareRegistrationInput | null>;
  /** 合成未就绪或失败时的同步回落图（通常来自 useShareCover("match").shareImageUrl） */
  fallbackImageUrl: MaybeReadonlyRef<string>;
  /** 隐藏 canvas 的 id / canvas-id，默认 match-share-card-canvas */
  canvasId?: string;
}

/**
 * 仅在微信小程序端驱动隐藏 canvas 异步合成 5:4 比赛信息分享卡（方案 C2）；
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
      homeShortsColor: options.homeShortsColor?.value ?? "",
      homeSocksColor: options.homeSocksColor?.value ?? "",
      awayTeamColor: options.awayTeamColor.value,
      awayShortsColor: options.awayShortsColor?.value ?? "",
      awaySocksColor: options.awaySocksColor?.value ?? "",
      customBgImageUrl: options.customBgImageUrl?.value?.trim() || "",
      startTime: current.start_time || current.holding_date,
      endTime: current.end_time,
      clockFallback: options.matchClockLabel.value,
      location: options.matchLocation.value || current.location,
      isPickupMatch: options.isPickupMatch?.value ?? false,
      isVenueMatch: options.isVenueMatch?.value ?? false,
      playersPerTeam: current.players_per_team,
      registration: options.registration?.value ?? null,
    };
  });

  // 仅当存在用户自定义分享背景图时才拉取底图；为空时走 C2 默认炽烈红黑射灯底。
  const backgroundCandidates = computed<string[]>(() => {
    const customBg = options.customBgImageUrl?.value?.trim() || "";
    return customBg ? [customBg] : [];
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
      input.homeShortsColor,
      input.homeSocksColor,
      input.awayTeamColor,
      input.awayShortsColor,
      input.awaySocksColor,
      input.customBgImageUrl,
      input.startTime,
      input.endTime,
      input.clockFallback,
      input.location,
      input.isPickupMatch,
      input.isVenueMatch,
      input.playersPerTeam ?? null,
      serializeRegistrationKey(input.registration),
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
    if (force && input.customBgImageUrl) {
      imageLoader.evict(input.customBgImageUrl);
    }

    const version = ++renderVersion;
    const snapshotInput: MatchShareCardInput = {
      ...input,
      registration: cloneRegistrationInput(input.registration),
    };
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
