import { computed, nextTick, ref, watch } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";
import { getMatchDetail } from "@/api/match";
import { getMatchLineup, saveMatchLineup } from "@/api/lineup";
import { getTeamDetail } from "@/api/team";
import { useTeamContext } from "@/stores/teamContext";
import type { BackendActivity } from "@/types/backend";
import type { AppMatchSummary } from "@/types/match";
import type {
  LineupCandidate,
  MatchLineupPlayer,
  MatchLineupSlot,
} from "@/types/lineup";
import { useMatchShareBg } from "../useMatchShareBg";
import {
  getDefaultFormation,
  getFormation,
  getFormationOptions,
  isValidFormation,
  normalizePlayersPerTeam,
} from "./formations";
import {
  applyDragOutcome,
  assignStarter,
  buildInitialLineupFromAttending,
  buildPitchSlots,
  canEditMatchLineup,
  collectAttendingParticipants,
  createDefaultSlots,
  findCurrentUserRole,
  getUnassignedAttending,
  normalizeLoadedSlots,
  parseLineupMatchId,
  removeSubPlayer,
  resetPositions,
  switchFormation,
  toggleSubPlayer,
  type DragOutcome,
} from "./helpers";
import {
  buildLineupSharePayload,
  composeLineupShareCard,
  createLineupImageLoader,
  formatLineupMatchTime,
  LINEUP_CARD,
  type LineupPosterInput,
} from "./lineupPoster";

export type PlayerSheetTab = "starter" | "sub";

export function useMatchLineupPage(pageInstance: unknown) {
  const { currentUser, currentTeam, ensureSessionReady, refreshSessionContext } = useTeamContext();

  const matchId = ref("");
  const loading = ref(true);
  const errorMessage = ref("");
  const match = ref<AppMatchSummary | null>(null);
  const backendMatchStub = ref<BackendActivity | null>(null);
  const hasSavedLineup = ref(false);
  const isGuestMode = ref(false);

  const formation = ref("1-2-1");
  const slots = ref<MatchLineupSlot[]>([]);
  const attendingCandidates = ref<LineupCandidate[]>([]);
  const teamOtherCandidates = ref<LineupCandidate[]>([]);
  const savedPlayersMap = ref<Record<number, MatchLineupPlayer>>({});

  const isDirty = ref(false);
  const saving = ref(false);
  const shareCardUrl = ref("");

  const sheetVisible = ref(false);
  const selectedSlot = ref<number | null>(null);
  const sheetTab = ref<PlayerSheetTab>("starter");

  let loadVersion = 0;
  let cardRenderVersion = 0;
  let cardTimer: ReturnType<typeof setTimeout> | null = null;
  let renderQueue: Promise<unknown> = Promise.resolve();
  let disposed = false;

  const imageLoader = createLineupImageLoader();

  const playersPerTeam = computed(() => normalizePlayersPerTeam(match.value?.players_per_team));
  const formationOptions = computed(() => getFormationOptions(playersPerTeam.value));
  const formationSlots = computed(() => getFormation(playersPerTeam.value, formation.value));

  const canEdit = computed(() =>
    canEditMatchLineup({
      match: match.value,
      isGuestMode: isGuestMode.value,
      currentUserId: currentUser.value?.id,
      currentTeam: currentTeam.value,
    }),
  );

  const isReadonly = computed(() => !canEdit.value);

  const playersById = computed<Record<number, MatchLineupPlayer>>(() => {
    const map: Record<number, MatchLineupPlayer> = { ...savedPlayersMap.value };
    for (const member of teamOtherCandidates.value) {
      map[member.user_id] = {
        user_id: member.user_id,
        nickname: member.nickname,
        avatar_url: member.avatar_url,
      };
    }
    for (const member of attendingCandidates.value) {
      map[member.user_id] = {
        user_id: member.user_id,
        nickname: member.nickname,
        avatar_url: member.avatar_url,
      };
    }
    if (currentUser.value?.id && !map[currentUser.value.id]) {
      map[currentUser.value.id] = {
        user_id: currentUser.value.id,
        nickname: currentUser.value.nickname?.trim() || "我",
        avatar_url: currentUser.value.avatar_url || null,
      };
    }
    return map;
  });

  const pitchSlots = computed(() => buildPitchSlots(slots.value, formationSlots.value, playersById.value));
  const unassignedAttending = computed(() => getUnassignedAttending(slots.value, attendingCandidates.value));
  const currentUserRole = computed(() => findCurrentUserRole(pitchSlots.value, currentUser.value?.id));
  const activeSlotView = computed(() =>
    selectedSlot.value === null
      ? null
      : (pitchSlots.value.find((item) => item.slot === selectedSlot.value) ?? null),
  );

  const matchTimeLabel = computed(() =>
    match.value ? formatLineupMatchTime(match.value.start_time, match.value.end_time) : "",
  );
  const starterCount = computed(() => pitchSlots.value.filter((item) => item.starter !== null).length);
  const subCount = computed(() => pitchSlots.value.reduce((sum, item) => sum + item.subs.length, 0));
  /** 阵型内至少选择 1 名队员（首发或替补）后才允许保存。 */
  const hasAnySelectedPlayer = computed(() => starterCount.value > 0 || subCount.value > 0);
  const canSaveLineup = computed(() => !isReadonly.value && !saving.value && hasAnySelectedPlayer.value);

  const pageTitle = computed(() => (canEdit.value ? "比赛排阵型" : "查看阵型"));
  const showEmptyReadonly = computed(
    () => !loading.value && !errorMessage.value && Boolean(match.value) && isReadonly.value && !hasSavedLineup.value,
  );

  // 复用比赛详情同源的球队会员与分享背景资源库管理逻辑，背景与会员权益按球队共享。
  const shareBg = useMatchShareBg({
    match: backendMatchStub,
    sourceMatch: match,
    isGuestMode,
    currentTeam,
    refreshSessionContext,
    onShareBgChanged: async () => {
      const bgUrl = match.value?.share_bg_image_url?.trim() || "";
      if (bgUrl) {
        imageLoader.evict(bgUrl);
      }
      await renderShareCard();
    },
  });

  function buildPosterInput(): LineupPosterInput | null {
    if (!match.value) return null;
    const hostTeamName = match.value.host_team_name?.trim() || currentTeam.value?.name?.trim() || "";
    const opponentName = match.value.opponent_name?.trim() || "";
    return {
      matchId: match.value.id,
      matchName: match.value.name,
      hostTeamName,
      opponentName,
      startTime: match.value.start_time,
      endTime: match.value.end_time,
      location: match.value.location,
      playersPerTeam: playersPerTeam.value,
      formation: formation.value,
      pitchSlots: pitchSlots.value,
      customBgImageUrl: match.value.share_bg_image_url ?? "",
    };
  }

  function enqueueRender<T>(action: () => Promise<T>): Promise<T> {
    const task = renderQueue.catch(() => undefined).then(action);
    renderQueue = task;
    return task;
  }

  function scheduleShareCardRender() {
    // #ifdef MP-WEIXIN
    if (disposed || !match.value || showEmptyReadonly.value) return;
    if (cardTimer) clearTimeout(cardTimer);
    cardTimer = setTimeout(() => {
      cardTimer = null;
      void renderShareCard();
    }, 180);
    // #endif
  }

  async function renderShareCard() {
    // #ifdef MP-WEIXIN
    const input = buildPosterInput();
    if (!input || disposed) return;
    const version = ++cardRenderVersion;
    try {
      await nextTick();
      const path = await enqueueRender(() =>
        composeLineupShareCard(
          LINEUP_CARD.canvasId,
          pageInstance,
          input,
          () => !disposed && version === cardRenderVersion,
          imageLoader.load,
        ),
      );
      if (!disposed && version === cardRenderVersion) {
        shareCardUrl.value = path;
      }
    } catch {
      // 分享图合成失败时回落微信默认截图，不阻断分享
    }
    // #endif
  }

  async function loadTeamMembersIfAvailable(teamId: number | null, attendingIds: Set<number>, version: number) {
    if (!teamId) {
      teamOtherCandidates.value = [];
      return;
    }
    try {
      const detail = await getTeamDetail(teamId);
      if (disposed || version !== loadVersion) return;
      const others: LineupCandidate[] = [];
      for (const member of detail.members) {
        if (member.status === 0 || attendingIds.has(member.user_id)) continue;
        others.push({
          user_id: member.user_id,
          nickname: member.nickname?.trim() || member.real_name?.trim() || `队员${member.user_id}`,
          avatar_url: member.avatar_url ?? null,
          source: "team",
        });
      }
      teamOtherCandidates.value = others;
    } catch {
      if (!disposed && version === loadVersion) {
        teamOtherCandidates.value = [];
      }
    }
  }

  async function loadPage() {
    const id = matchId.value;
    if (!id) {
      loading.value = false;
      errorMessage.value = "缺少比赛标识，请从比赛详情重新进入";
      return;
    }
    const version = ++loadVersion;
    loading.value = true;
    errorMessage.value = "";
    isDirty.value = false;

    try {
      try {
        await ensureSessionReady();
      } catch {
        // 允许后续按真实接口错误反馈
      }
      if (disposed || version !== loadVersion) return;
      isGuestMode.value = !currentUser.value;

      const [detailResp, lineupResp] = await Promise.all([
        getMatchDetail(id),
        getMatchLineup(id).catch(() => ({ lineup: null })),
      ]);
      if (disposed || version !== loadVersion) return;

      match.value = detailResp.match;
      const attending = collectAttendingParticipants(detailResp, currentTeam.value?.id);
      attendingCandidates.value = attending;

      const saved = lineupResp?.lineup ?? null;
      const savedMap: Record<number, MatchLineupPlayer> = {};
      for (const p of saved?.players ?? []) {
        savedMap[p.user_id] = {
          user_id: p.user_id,
          nickname: p.nickname?.trim() || `队员${p.user_id}`,
          avatar_url: p.avatar_url ?? null,
        };
      }
      savedPlayersMap.value = savedMap;

      const size = normalizePlayersPerTeam(detailResp.match.players_per_team);
      const editable = canEditMatchLineup({
        match: detailResp.match,
        isGuestMode: isGuestMode.value,
        currentUserId: currentUser.value?.id,
        currentTeam: currentTeam.value,
      });

      if (saved) {
        hasSavedLineup.value = true;
        const resolvedFormation = isValidFormation(size, saved.formation)
          ? saved.formation
          : getDefaultFormation(size);
        formation.value = resolvedFormation;
        slots.value = normalizeLoadedSlots(saved.slots, size, resolvedFormation);
      } else {
        hasSavedLineup.value = false;
        const defaultForm = getDefaultFormation(size);
        formation.value = defaultForm;
        slots.value = editable
          ? buildInitialLineupFromAttending(
              size,
              defaultForm,
              attending.map((item) => item.user_id),
            )
          : createDefaultSlots(size, defaultForm);
      }

      if (editable && detailResp.match.host_team_id) {
        const attendingIdSet = new Set(attending.map((item) => item.user_id));
        void loadTeamMembersIfAvailable(detailResp.match.host_team_id, attendingIdSet, version);
      } else {
        teamOtherCandidates.value = [];
      }

      scheduleShareCardRender();
    } catch (error) {
      if (!disposed && version === loadVersion) {
        errorMessage.value = error instanceof Error ? error.message : "加载比赛阵型失败，请稍后重试";
      }
    } finally {
      if (!disposed && version === loadVersion) {
        loading.value = false;
      }
    }
  }

  function selectFormation(code: string) {
    if (isReadonly.value || code === formation.value) return;
    if (!isValidFormation(playersPerTeam.value, code)) return;
    formation.value = code;
    slots.value = switchFormation(slots.value, playersPerTeam.value, code);
    isDirty.value = true;
    scheduleShareCardRender();
  }

  function openSlotSheet(slot: number, tab: PlayerSheetTab = "starter") {
    if (isReadonly.value) return;
    selectedSlot.value = slot;
    sheetTab.value = tab;
    sheetVisible.value = true;
  }

  function closeSlotSheet() {
    sheetVisible.value = false;
  }

  function handlePitchTap(slot: number) {
    if (isReadonly.value) return;
    openSlotSheet(slot, "starter");
  }

  function handlePitchDrag(slot: number, outcome: DragOutcome) {
    if (isReadonly.value) return;
    slots.value = applyDragOutcome(slots.value, slot, outcome);
    isDirty.value = true;
    scheduleShareCardRender();
  }

  function handleAssignStarter(playerId: number | null) {
    if (isReadonly.value || selectedSlot.value === null) return;
    slots.value = assignStarter(slots.value, selectedSlot.value, playerId);
    isDirty.value = true;
    scheduleShareCardRender();
  }

  function handleToggleSub(playerId: number) {
    if (isReadonly.value || selectedSlot.value === null) return;
    slots.value = toggleSubPlayer(slots.value, selectedSlot.value, playerId);
    isDirty.value = true;
    scheduleShareCardRender();
  }

  function handleRemoveSub(slot: number, playerId: number) {
    if (isReadonly.value) return;
    slots.value = removeSubPlayer(slots.value, slot, playerId);
    isDirty.value = true;
    scheduleShareCardRender();
  }

  function handleResetPositions() {
    if (isReadonly.value) return;
    slots.value = resetPositions(slots.value, playersPerTeam.value, formation.value);
    isDirty.value = true;
    uni.showToast({ title: "已重置为默认站位", icon: "none" });
    scheduleShareCardRender();
  }

  async function handleSave() {
    if (!canSaveLineup.value || !match.value) return;
    saving.value = true;
    try {
      const response = await saveMatchLineup(match.value.id, {
        formation: formation.value,
        slots: slots.value,
      });
      if (disposed) return;
      const saved = response?.lineup;
      if (saved) {
        const nextMap: Record<number, MatchLineupPlayer> = { ...savedPlayersMap.value };
        for (const p of saved.players ?? []) {
          nextMap[p.user_id] = {
            user_id: p.user_id,
            nickname: p.nickname?.trim() || `队员${p.user_id}`,
            avatar_url: p.avatar_url ?? null,
          };
        }
        savedPlayersMap.value = nextMap;
        slots.value = normalizeLoadedSlots(saved.slots, playersPerTeam.value, saved.formation);
      }
      hasSavedLineup.value = true;
      isDirty.value = false;
      uni.showToast({ title: "阵型已保存", icon: "success" });
      scheduleShareCardRender();
    } catch (error) {
      uni.showToast({
        title: error instanceof Error ? error.message : "保存阵型失败，请重试",
        icon: "none",
      });
    } finally {
      saving.value = false;
    }
  }

  function friendShare() {
    if (!match.value) {
      return {
        title: "查看比赛阵型",
        path: matchId.value ? `/pages/matches/lineup/index?matchId=${encodeURIComponent(matchId.value)}` : "/pages/home/index",
      };
    }
    return buildLineupSharePayload({
      matchId: match.value.id,
      matchName: match.value.name,
      playersPerTeam: playersPerTeam.value,
      formation: formation.value,
      imageUrl: shareCardUrl.value || undefined,
    });
  }

  function timelineShare() {
    const payload = friendShare();
    return {
      title: payload.title,
      query: matchId.value ? `matchId=${encodeURIComponent(matchId.value)}` : "",
      ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
    };
  }

  function handleBackToDetail() {
    const pages = getCurrentPages();
    if (pages.length > 1) {
      uni.navigateBack();
      return;
    }
    if (matchId.value) {
      uni.redirectTo({ url: `/pages/matches/detail?id=${encodeURIComponent(matchId.value)}` });
      return;
    }
    uni.switchTab({ url: "/pages/home/index" });
  }

  watch(
    () => [currentUser.value?.id, currentTeam.value?.id],
    () => {
      if (!disposed && matchId.value && !loading.value && !saving.value && !isDirty.value) {
        void loadPage();
      }
    },
  );

  onLoad((options) => {
    matchId.value = parseLineupMatchId(options);
    // #ifdef MP-WEIXIN
    try {
      uni.showShareMenu({
        withShareTicket: true,
        menus: ["shareAppMessage", "shareTimeline"],
      });
    } catch {
      // 部分基础库不支持 menus 参数时保持 onShareAppMessage/onShareTimeline 默认生效
    }
    void loadPage();
    // #endif
    // #ifndef MP-WEIXIN
    loading.value = false;
    // #endif
  });

  onUnload(() => {
    disposed = true;
    loadVersion += 1;
    cardRenderVersion += 1;
    if (cardTimer) clearTimeout(cardTimer);
    imageLoader.clear();
  });

  return {
    matchId,
    loading,
    errorMessage,
    match,
    currentTeam,
    hasSavedLineup,
    playersPerTeam,
    formation,
    formationOptions,
    pitchSlots,
    attendingCandidates,
    teamOtherCandidates,
    unassignedAttending,
    currentUser,
    currentUserRole,
    canEdit,
    isReadonly,
    isDirty,
    saving,
    hasAnySelectedPlayer,
    canSaveLineup,
    showEmptyReadonly,
    pageTitle,
    matchTimeLabel,
    starterCount,
    subCount,
    sheetVisible,
    selectedSlot,
    sheetTab,
    activeSlotView,
    shareBg,
    loadPage,
    selectFormation,
    openSlotSheet,
    closeSlotSheet,
    handlePitchTap,
    handlePitchDrag,
    handleAssignStarter,
    handleToggleSub,
    handleRemoveSub,
    handleResetPositions,
    handleSave,
    handleBackToDetail,
    friendShare,
    timelineShare,
  };
}
