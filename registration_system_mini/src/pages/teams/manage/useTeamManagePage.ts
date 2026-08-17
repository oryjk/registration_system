import { computed, reactive, ref, watch } from "vue";
import { onShow } from "@dcloudio/uni-app";
import type { NeoSegmentOption } from "@/components/neo/NeoSegmentedControl.vue";
import { getCustomNavMetrics } from "@/utils/customNav";
import { useTeamContext } from "@/stores/teamContext";
import { preloadMiniReviewStatus, useMiniReviewStatus } from "@/stores/miniReview";
import type { BackendTeamMember, BackendTeamSummary, BackendUser } from "@/types/backend";
import {
  checkTeamRequiresPassword,
  createTeamFromForm,
  joinTeamFromForm,
  loadUsersById,
  searchTeamsByKeyword,
} from "./teamManageActions";
import { formatAttendanceDate, resolveVisibleMode, type TeamManageMode } from "./teamManageState";
import { useTeamProfile } from "./useTeamProfile";
import { useTeamMembership } from "./useTeamMembership";
import { useTeamAttendance } from "./useTeamAttendance";

export function useTeamManagePage() {
  const {
    currentTeam,
    currentUser,
    teamDetailsById,
    ensureSessionReady,
    ensureTeamDetailLoaded,
    refreshSessionContext,
  } = useTeamContext();
  const { reviewMode, shouldHideCreationEntrances } = useMiniReviewStatus();
  const navMetrics = getCustomNavMetrics();

  const activeMode = ref<TeamManageMode>("profile");
  const submitting = ref(false);
  const searching = ref(false);
  const searchKeyword = ref("");
  const searchResults = ref<BackendTeamSummary[]>([]);
  const selectedTeam = ref<BackendTeamSummary | null>(null);
  const selectedTeamRequiresPassword = ref(false);
  const joinPassword = ref("");
  const usersById = ref<Record<number, BackendUser>>({});
  const reviewTeamNameOptions = ["星火联队", "周末竞技 FC", "白银风暴", "东城野球会", "黑曜九号"];
  const createTeamReviewMode = reviewMode;
  const createForm = reactive({ name: "", description: "", joinPassword: "" });

  const currentMembers = computed<BackendTeamMember[]>(() => {
    const teamId = currentTeam.value?.id;
    return teamId ? teamDetailsById.value[teamId]?.members ?? [] : [];
  });
  const canCreate = computed(() => !!createForm.name.trim() && !submitting.value);
  const canJoin = computed(() => !!selectedTeam.value && !submitting.value);
  const hasCurrentTeam = computed(() => !!currentTeam.value);
  // 只有队长/领队可以进入球队管理；普通队员打开本页时展示无权限态（创建/加入球队不受限——那是无球队用户的入口）。
  const canManageCurrentTeam = computed(() => !!currentTeam.value?.canManageTeam);
  const isManagementBlocked = computed(() => hasCurrentTeam.value && !canManageCurrentTeam.value);
  const heroTitle = computed(() => (currentTeam.value ? currentTeam.value.name : "创建或加入一支球队"));
  const heroCopy = computed(() =>
    currentTeam.value ? "管理当前球队资料、队员和球队上下文。" : "球队会影响首页、约队、统计和报名上下文。",
  );
  const pageStyle = computed(() => ({ paddingTop: `${navMetrics.pageTopPadding + 8}px` }));
  const canShowCreateTeamEntry = computed(() => !shouldHideCreationEntrances.value);
  const modeOptions = computed<NeoSegmentOption[]>(() => {
    if (hasCurrentTeam.value) {
      return [
        { label: "球队资料", value: "profile" },
        { label: "队员管理", value: "members" },
        { label: "比赛出勤", value: "attendance" },
      ];
    }
    return [
      ...(canShowCreateTeamEntry.value ? [{ label: "创建球队", value: "create" }] : []),
      { label: "加入球队", value: "join" },
    ];
  });

  const profile = useTeamProfile({ currentTeam, submitting, refreshSessionContext });
  const attendance = useTeamAttendance({ currentTeam, currentUser, currentMembers, usersById, ensureTeamDetailLoaded });
  const membership = useTeamMembership({
    currentTeam,
    currentUser,
    currentMembers,
    usersById,
    submitting,
    refreshSessionContext,
    invalidateActivityAttendance: attendance.invalidateActivityAttendance,
  });

  function syncVisibleMode() {
    activeMode.value = resolveVisibleMode(hasCurrentTeam.value, activeMode.value, canShowCreateTeamEntry.value);
  }

  function resetJoinSelection() {
    selectedTeam.value = null;
    selectedTeamRequiresPassword.value = false;
    joinPassword.value = "";
  }

  async function hydrateCreateTeamReviewMode() {
    await preloadMiniReviewStatus();
    if (createTeamReviewMode.value && !reviewTeamNameOptions.includes(createForm.name)) {
      createForm.name = reviewTeamNameOptions[0] || "";
      createForm.description = "";
    }
  }

  function handleSelectMode(mode: TeamManageMode) {
    activeMode.value = mode;
    if (mode === "attendance") void attendance.loadTeamActivityAttendanceSummaries();
  }

  function handleModeChange(mode: string) {
    handleSelectMode(mode as TeamManageMode);
  }

  async function handleCreateTeam() {
    if (!canCreate.value) {
      uni.showToast({ title: "请输入球队名称", icon: "none" });
      return;
    }
    submitting.value = true;
    try {
      await createTeamFromForm({
        name: createForm.name.trim(),
        description: createTeamReviewMode.value ? undefined : createForm.description.trim() || undefined,
        joinPassword: createForm.joinPassword.trim() || undefined,
      });
      await refreshSessionContext();
      uni.showToast({ title: "球队已创建", icon: "none" });
      uni.switchTab({ url: "/pages/user/index" });
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "创建球队失败", icon: "none" });
    } finally {
      submitting.value = false;
    }
  }

  async function handleSearchTeams() {
    const keyword = searchKeyword.value.trim();
    if (!keyword) {
      uni.showToast({ title: "请输入球队名称", icon: "none" });
      return;
    }
    searching.value = true;
    resetJoinSelection();
    try {
      searchResults.value = await searchTeamsByKeyword(keyword);
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "搜索球队失败", icon: "none" });
    } finally {
      searching.value = false;
    }
  }

  async function handleSelectTeam(team: BackendTeamSummary) {
    selectedTeam.value = team;
    joinPassword.value = "";
    try {
      selectedTeamRequiresPassword.value = await checkTeamRequiresPassword(team.id);
    } catch (error) {
      selectedTeamRequiresPassword.value = false;
      uni.showToast({ title: error instanceof Error ? error.message : "密码信息加载失败", icon: "none" });
    }
  }

  async function handleJoinTeam() {
    if (!selectedTeam.value) {
      uni.showToast({ title: "请选择要加入的球队", icon: "none" });
      return;
    }
    if (selectedTeamRequiresPassword.value && !joinPassword.value.trim()) {
      uni.showToast({ title: "请输入入队密码", icon: "none" });
      return;
    }
    submitting.value = true;
    try {
      await joinTeamFromForm({ teamId: selectedTeam.value.id, password: joinPassword.value.trim() || undefined });
      await refreshSessionContext();
      uni.showToast({ title: "已加入球队", icon: "none" });
      uni.switchTab({ url: "/pages/user/index" });
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "加入球队失败", icon: "none" });
    } finally {
      submitting.value = false;
    }
  }

  watch(hasCurrentTeam, syncVisibleMode);
  watch(() => currentTeam.value?.id, attendance.invalidateActivityAttendance);

  onShow(async () => {
    await ensureSessionReady();
    // 普通队员无管理权限：不加载管理数据，模板层展示无权限态。
    if (isManagementBlocked.value) return;
    if (currentTeam.value) await ensureTeamDetailLoaded(currentTeam.value.id);
    syncVisibleMode();
    profile.syncTeamProfileForm();
    await hydrateCreateTeamReviewMode();
    try {
      usersById.value = await loadUsersById();
    } catch (_error) {
      usersById.value = {};
    }
    if (activeMode.value === "attendance") await attendance.loadTeamActivityAttendanceSummaries();
  });

  return {
    currentTeam,
    activeMode,
    isManagementBlocked,
    submitting,
    searching,
    searchKeyword,
    searchResults,
    selectedTeam,
    selectedTeamRequiresPassword,
    joinPassword,
    createForm,
    canCreate,
    canJoin,
    heroTitle,
    heroCopy,
    pageStyle,
    modeOptions,
    createTeamReviewMode,
    reviewTeamNameOptions,
    formatAttendanceDate,
    handleModeChange,
    handleCreateTeam,
    handleSearchTeams,
    handleSelectTeam,
    handleJoinTeam,
    ...profile,
    ...attendance,
    ...membership,
  };
}
