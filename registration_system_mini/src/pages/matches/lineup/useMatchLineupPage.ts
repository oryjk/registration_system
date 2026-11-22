import { computed, nextTick, ref, watch } from "vue";
import { onLoad, onUnload } from "@dcloudio/uni-app";
import { getMatchDetail } from "@/api/match";
import { getMatchLineup, getMatchLineupMiniCode, saveMatchLineup } from "@/api/lineup";
import { getTeamDetail } from "@/api/team";
import { useTeamContext } from "@/stores/teamContext";
import type { AppMatchSummary } from "@/types/match";
import type {
  LineupCandidate,
  MatchLineupPlayer,
  MatchLineupSlot,
  MiniProgramEnv,
} from "@/types/lineup";
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
  composeLineupImage,
  createLineupImageLoader,
  formatLineupMatchTime,
  LINEUP_CARD,
  LINEUP_POSTER,
  type LineupPosterInput,
} from "./lineupPoster";

export type PlayerSheetTab = "starter" | "sub";

function readMiniProgramEnv(): MiniProgramEnv {
  // #ifdef MP-WEIXIN
  try {
    const env = uni.getAccountInfoSync().miniProgram.envVersion;
    if (env === "develop" || env === "trial") return env;
  } catch {
    // 兜底正式版
  }
  // #endif
  return "release";
}

export function useMatchLineupPage(pageInstance: unknown) {
  const { currentUser, currentTeam, ensureSessionReady } = useTeamContext();

  const matchId = ref("");
  const loading = ref(true);
  const errorMessage = ref("");
  const match = ref<AppMatchSummary | null>(null);
  const hasSavedLineup = ref(false);
  const isGuestMode = ref(false);

  const formation = ref("1-2-1");
  const slots = ref<MatchLineupSlot[]>([]);
  const attendingCandidates = ref<LineupCandidate[]>([]);
  const teamOtherCandidates = ref<LineupCandidate[]>([]);
  const savedPlayersMap = ref<Record<number, MatchLineupPlayer>>({});

  const isDirty = ref(false);
  const saving = ref(false);
  const savingPoster = ref(false);
  const shareCardUrl = ref("");

  const sheetVisible = ref(false);
  const selectedSlot = ref<number | null>(null);
  const sheetTab = ref<PlayerSheetTab>("starter");

  let loadVersion = 0;
  let cardRenderVersion = 0;
  let cardTimer: ReturnType<typeof setTimeout> | null = null;
  let renderQueue: Promise<unknown> = Promise.resolve();
  let cachedMiniCodeUrl: { matchId: string; url: string } | null = null;
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

  const pageTitle = computed(() => (canEdit.value ? "比赛排阵型" : "查看阵型"));
  const showEmptyReadonly = computed(() => !loading.value && !errorMessage.value && Boolean(match.value) && isReadonly.value && !hasSavedLineup.value);

  function buildPosterInput(): LineupPosterInput | null {
    if (!match.value) return null;
    return {
      matchId: match.value.id,
      matchName: match.value.name,
      startTime: match.value.start_time,
      endTime: match.value.end_time,
      location: match.value.location,
      playersPerTeam: playersPerTeam.value,
      formation: formation.value,
      pitchSlots: pitchSlots.value,
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
        composeLineupImage(
          LINEUP_CARD.canvasId,
          pageInstance,
          input,
          "card",
          null,
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
    if (isReadonly.value || saving.value || !match.value) return;
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

  async function fetchMiniCodeGracefully(id: string): Promise<string | null> {
    if (cachedMiniCodeUrl && cachedMiniCodeUrl.matchId === id) {
      return cachedMiniCodeUrl.url;
    }
    try {
      const resp = await getMatchLineupMiniCode(id, readMiniProgramEnv());
      const url = resp?.image_url?.trim() || "";
      if (url) {
        cachedMiniCodeUrl = { matchId: id, url };
        return url;
      }
    } catch {
      // 小程序码获取失败优雅降级，不阻断海报保存
    }
    return null;
  }

  async function handleSavePoster() {
    if (savingPoster.value || !match.value) return;
    const input = buildPosterInput();
    if (!input) return;

    savingPoster.value = true;
    uni.showLoading({ title: "正在生成海报…", mask: true });
    const version = loadVersion;
    try {
      const miniCodeUrl = await fetchMiniCodeGracefully(input.matchId);
      if (disposed || version !== loadVersion) return;

      await nextTick();
      const posterPath = await enqueueRender(() =>
        composeLineupImage(
          LINEUP_POSTER.canvasId,
          pageInstance,
          input,
          "poster",
          miniCodeUrl,
          () => !disposed && version === loadVersion,
          imageLoader.load,
        ),
      );
      if (disposed || version !== loadVersion) return;

      // #ifdef MP-WEIXIN
      await new Promise<void>((resolve, reject) => {
        uni.saveImageToPhotosAlbum({
          filePath: posterPath,
          success: () => resolve(),
          fail: reject,
        });
      });
      uni.hideLoading();
      uni.showToast({ title: "海报已保存到相册", icon: "success" });
      // #endif
    } catch (error) {
      uni.hideLoading();
      const detail =
        error && typeof error === "object" && "errMsg" in error
          ? String((error as { errMsg?: unknown }).errMsg ?? "")
          : "";
      if (/auth|deny|denied/i.test(detail)) {
        uni.showModal({
          title: "需要相册权限",
          content: "允许保存到相册后，即可保存本场阵型海报。",
          confirmText: "去设置",
          success: (res) => {
            if (res.confirm) uni.openSetting({});
          },
        });
      } else if (!/cancel/i.test(detail)) {
        uni.showToast({
          title: error instanceof Error ? error.message : "海报保存失败，请重试",
          icon: "none",
        });
      }
    } finally {
      uni.hideLoading();
      savingPoster.value = false;
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
    savingPoster,
    showEmptyReadonly,
    pageTitle,
    matchTimeLabel,
    starterCount,
    subCount,
    sheetVisible,
    selectedSlot,
    sheetTab,
    activeSlotView,
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
    handleSavePoster,
    handleBackToDetail,
    friendShare,
    timelineShare,
  };
}
