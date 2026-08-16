import { computed, ref } from "vue";
import { listMatches } from "@/api/match";
import { useMiniReviewStatus } from "@/stores/miniReview";
import { useTeamContext } from "@/stores/teamContext";
import { hasManualLogout } from "@/utils/authStorage";
import type { AppMatchSummary } from "@/types/match";
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
const HALL_PUBLICATION_MODES = ["online_team", "online_individual"] as const;

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
  const pagination = ref<HallPaginationState>(createInitialPagination());
  const activeKind = ref<HallMatchKindFilter>("all");
  const activeSize = ref<HallMatchSizeFilter>(0);
  const selectedDateKey = ref("");
  const calendarDays = ref<HallCalendarDay[]>(buildHallCalendarDays(new Date()));
  const nowTick = ref(Date.now());

  let loadVersion = 0;
  let windowTimer: ReturnType<typeof setInterval> | null = null;

  const showInitialLoadingState = computed(() => isLoading.value && !hasLoadedOnce.value);
  const canPublish = computed(() => !!currentIdentity.value && !shouldHideCreationEntrances.value);
  // 按钮判定依赖当前球队身份：主队成员见"去报名"，对方队长见"去接约"，其余见"查看比赛"。
  const hallViewer = computed(() => ({
    teamId: currentTeam.value?.id ?? null,
    canManageTeam: !!currentTeam.value?.canManageTeam,
  }));
  const hallCards = computed<HallMatchCardViewModel[]>(() => {
    const cards = sourceMatches.value.map((match) =>
      toHallMatchCard(match, hallViewer.value, nowTick.value),
    );
    return filterHallMatches(cards, sourceMatches.value, activeKind.value === "mine" ? "all" : activeKind.value, activeSize.value);
  });
  const hasMore = computed(() => !isPaginationComplete(sourceMatches.value, pagination.value));

  function fetchHallPage(page: number) {
    return listMatches({
      scope: activeKind.value === "mine" ? "mine" : "all",
      status: "registering",
      // 后端 start_time 存 UTC 时刻；时间过滤统一传 UTC 时刻。
      startsAfter: new Date(),
      publicationModes: [...HALL_PUBLICATION_MODES],
      dateStart: selectedDateKey.value ? toLocalMidnightDate(selectedDateKey.value) ?? undefined : undefined,
      page,
      pageSize: HALL_PAGE_SIZE,
    });
  }

  async function loadPageData(options?: { preserveContent?: boolean }) {
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
        pagination.value = createInitialPagination();
        hasLoadedOnce.value = true;
        return;
      }

      isGuestMode.value = false;
      await ensureSessionReady();
      if (version !== loadVersion) return;

      const response = await fetchHallPage(1);
      if (version !== loadVersion) return;

      sourceMatches.value = response.items;
      pagination.value = { page: 1, total: response.total };
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
    const scopeChanged = (kind === "mine") !== (activeKind.value === "mine");
    activeKind.value = kind;
    if (scopeChanged) {
      void loadPageData({ preserveContent: hasLoadedOnce.value });
    }
  }

  function selectSize(size: HallMatchSizeFilter) {
    activeSize.value = size;
  }

  function selectDate(key: string) {
    if (key === selectedDateKey.value) return;
    selectedDateKey.value = key;
    void loadPageData({ preserveContent: hasLoadedOnce.value });
  }

  async function handleLogin() {
    try {
      await ensureSessionReady(true);
      await loadPageData({ preserveContent: false });
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
    canPublish,
    hallCards,
    hasMore,
    calendarDays,
    activeKind,
    activeSize,
    selectedDateKey,
    loadPageData,
    loadMore,
    selectKind,
    selectSize,
    selectDate,
    handleLogin,
    startWindowTimer,
    stopWindowTimer,
  };
}
