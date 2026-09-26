import { computed, ref } from "vue";
import { listMatches } from "@/api/match";
import { toHomeMatchCard } from "@/pages/home/homeMatchState";
import { useMiniReviewStatus } from "@/stores/miniReview";
import { useTeamContext } from "@/stores/teamContext";
import { getAccessToken, hasManualLogout } from "@/utils/authStorage";
import type { AppMatchSummary } from "@/types/match";
import type { HomeMatchCardViewModel } from "@/types/viewModels";
import {
  buildHallCalendarDays,
  filterHallMatches,
  toHallMatchCard,
  toLocalMidnightDate,
  type HallCalendarDay,
  type HallMatchCardViewModel,
  type HallMatchKindFilter,
  type HallMatchSizeFilter,
} from "./hallMatchState";

const HALL_PAGE_SIZE = 20;
const HALL_ENDED_REFERENCE_LIMIT = 3;
const HALL_PUBLICATION_MODES = ["online_team", "online_individual", "online_pickup"] as const;

interface HallPaginationState {
  page: number;
  total: number;
}

function createInitialPagination(): HallPaginationState {
  return { page: 1, total: 0 };
}

function isPaginationComplete(sourceMatches: AppMatchSummary[], pagination: HallPaginationState): boolean {
  // total=0 是服务端明确告知没有数据；否则以已加载条数对比总数判断。
  if (pagination.total === 0) {
    return true;
  }
  return sourceMatches.length >= pagination.total;
}

export function useHallPage() {
  const { ensureSessionReady, currentIdentity, currentTeam } = useTeamContext();
  const { shouldHideCreationEntrances } = useMiniReviewStatus();

  const isLoading = ref(false);
  const isRefreshing = ref(false);
  const isLoadingMore = ref(false);
  const hasLoadedOnce = ref(false);
  const errorMessage = ref("");
  const isGuestMode = ref(true);
  const sourceMatches = ref<AppMatchSummary[]>([]);
  const endedReferenceMatches = ref<AppMatchSummary[]>([]);
  const pagination = ref<HallPaginationState>(createInitialPagination());
  const activeKind = ref<HallMatchKindFilter>("all");
  const activeSize = ref<HallMatchSizeFilter>(0);
  const selectedDateKey = ref("");
  const calendarDays = ref<HallCalendarDay[]>(buildHallCalendarDays(new Date()));
  const nowTick = ref(Date.now());

  let loadVersion = 0;
  // 会话数据已由 useTeamContext 持有；切换日期只需要重新拉比赛。
  let validatedSessionToken: string | null = null;
  let windowTimer: ReturnType<typeof setInterval> | null = null;

  const showInitialLoadingState = computed(() => isLoading.value && !hasLoadedOnce.value);
  // 发布面板对所有登录用户开放（散人也能发布散人约球）；仅审核隐藏期统一关闭。
  const canOpenPublishSheet = computed(() => !shouldHideCreationEntrances.value);
  // 球队约队/创建比赛需要可管理的球队或场馆身份；散人点击时由页面弹窗引导开通。
  const hasPublishIdentity = computed(() => !!currentIdentity.value);
  // 按钮判定依赖当前球队身份：主队成员见"去报名"，其他球队队长见"接约"，其余见"查看详情"。
  const hallViewer = computed(() => ({
    teamId: currentTeam.value?.id ?? null,
    isCaptain: !!currentTeam.value?.isCaptain,
  }));
  const hallCards = computed<HallMatchCardViewModel[]>(() => {
    const cards = sourceMatches.value.map((match) =>
      toHallMatchCard(match, hallViewer.value, nowTick.value),
    );
    return filterHallMatches(cards, sourceMatches.value, activeKind.value, activeSize.value);
  });
  const endedReferenceCards = computed<HomeMatchCardViewModel[]>(() =>
    endedReferenceMatches.value.map((match) => toHomeMatchCard(match, "ended")),
  );
  const hasMore = computed(() => !isPaginationComplete(sourceMatches.value, pagination.value));
  const sourceMatchCount = computed(() => sourceMatches.value.length);

  function fetchHallPage(page: number) {
    return listMatches({
      scope: "all",
      status: "registering",
      // 后端 start_time 存 UTC 时刻；时间过滤统一传 UTC 时刻。
      startsAfter: new Date(),
      publicationModes: [...HALL_PUBLICATION_MODES],
      dateStart: selectedDateKey.value ? toLocalMidnightDate(selectedDateKey.value) ?? undefined : undefined,
      page,
      pageSize: HALL_PAGE_SIZE,
    });
  }

  function fetchEndedReferences() {
    return listMatches({
      scope: "all",
      status: "ended",
      publicationModes: [...HALL_PUBLICATION_MODES],
      page: 1,
      pageSize: HALL_ENDED_REFERENCE_LIMIT,
    });
  }

  async function loadPageData(options?: { preserveContent?: boolean; reuseSession?: boolean }) {
    const version = ++loadVersion;
    const preserveContent = !!options?.preserveContent && hasLoadedOnce.value;

    if (preserveContent) {
      isRefreshing.value = true;
    } else {
      isLoading.value = true;
    }
    errorMessage.value = "";

    try {
      if (hasManualLogout()) {
        if (version !== loadVersion) return;
        isGuestMode.value = true;
        sourceMatches.value = [];
        endedReferenceMatches.value = [];
        pagination.value = createInitialPagination();
        hasLoadedOnce.value = true;
        return;
      }

      isGuestMode.value = false;
      if (!options?.reuseSession || validatedSessionToken !== getAccessToken()) {
        await ensureSessionReady();
        if (version !== loadVersion) return;
        validatedSessionToken = getAccessToken();
      }

      const response = await fetchHallPage(1);
      if (version !== loadVersion) return;

      sourceMatches.value = response.items;
      pagination.value = { page: 1, total: response.total };

      // 只有「全大厅确实没有可加入比赛」时才补历史参考。
      // 日期筛选导致的空结果属于 filtered empty，不展示历史卡片以免混淆。
      const shouldLoadEndedReferences =
        response.total === 0
        && response.items.length === 0
        && !selectedDateKey.value;
      if (shouldLoadEndedReferences) {
        try {
          const endedResponse = await fetchEndedReferences();
          if (version !== loadVersion) return;
          endedReferenceMatches.value = endedResponse.items;
        } catch (_error) {
          if (version !== loadVersion) return;
          // 历史比赛只是空状态增强；失败不影响大厅主体和发布入口。
          endedReferenceMatches.value = [];
        }
      } else {
        endedReferenceMatches.value = [];
      }

      hasLoadedOnce.value = true;
    } catch (error) {
      if (version !== loadVersion) return;
      errorMessage.value = error instanceof Error ? error.message : "约队大厅加载失败";
    } finally {
      if (version !== loadVersion) return;
      if (preserveContent) {
        isRefreshing.value = false;
      } else {
        isLoading.value = false;
      }
    }
  }

  async function loadMore() {
    if (isLoadingMore.value || !hasMore.value || isGuestMode.value) return;

    const version = loadVersion;
    isLoadingMore.value = true;
    try {
      const response = await fetchHallPage(pagination.value.page + 1);
      if (version !== loadVersion) return;

      const merged = new Map(sourceMatches.value.map((match) => [match.id, match]));
      for (const item of response.items) {
        merged.set(item.id, item);
      }
      sourceMatches.value = [...merged.values()];
      pagination.value = { page: pagination.value.page + 1, total: response.total };
    } catch (error) {
      uni.showToast({
        title: error instanceof Error ? error.message : "加载更多失败",
        icon: "none",
      });
    } finally {
      isLoadingMore.value = false;
    }
  }

  function selectKind(kind: HallMatchKindFilter) {
    activeKind.value = kind;
  }

  function selectSize(size: HallMatchSizeFilter) {
    activeSize.value = size;
  }

  function selectDate(key: string) {
    if (key === selectedDateKey.value) return;
    selectedDateKey.value = key;
    void loadPageData({ preserveContent: hasLoadedOnce.value, reuseSession: true });
  }

  function resetHallFilters() {
    const hadDateFilter = !!selectedDateKey.value;
    activeKind.value = "all";
    activeSize.value = 0;
    selectedDateKey.value = "";
    if (hadDateFilter) {
      void loadPageData({ preserveContent: hasLoadedOnce.value, reuseSession: true });
    }
  }

  async function handleLogin() {
    try {
      await ensureSessionReady(true);
      validatedSessionToken = getAccessToken();
      await loadPageData({ preserveContent: false, reuseSession: true });
    } catch (error) {
      uni.showToast({
        title: error instanceof Error ? error.message : "登录失败",
        icon: "none",
      });
    }
  }

  function stopWindowTimer() {
    if (!windowTimer) return;
    clearInterval(windowTimer);
    windowTimer = null;
  }

  function startWindowTimer() {
    nowTick.value = Date.now();
    stopWindowTimer();
    windowTimer = setInterval(() => {
      nowTick.value = Date.now();
    }, 1_000);
  }

  return {
    isLoading,
    isRefreshing,
    isLoadingMore,
    hasLoadedOnce,
    showInitialLoadingState,
    errorMessage,
    isGuestMode,
    canOpenPublishSheet,
    hasPublishIdentity,
    hallCards,
    endedReferenceCards,
    hallViewer,
    nowTick,
    hasMore,
    sourceMatchCount,
    calendarDays,
    activeKind,
    activeSize,
    selectedDateKey,
    loadPageData,
    loadMore,
    selectKind,
    selectSize,
    selectDate,
    resetHallFilters,
    handleLogin,
    startWindowTimer,
    stopWindowTimer,
  };
}
