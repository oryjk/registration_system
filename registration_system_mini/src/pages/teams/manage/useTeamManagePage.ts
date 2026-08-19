import { computed, ref, watch } from "vue";
import { onShow } from "@dcloudio/uni-app";
import type { NeoSegmentOption } from "@/components/neo/NeoSegmentedControl.vue";
import { getCustomNavMetrics } from "@/utils/customNav";
import { useTeamContext } from "@/stores/teamContext";
import { useMiniReviewStatus } from "@/stores/miniReview";
import type { BackendTeamMember, BackendUser } from "@/types/backend";
import { loadUsersById } from "./teamManageActions";
import { formatAttendanceDate, type TeamManageMode } from "./teamManageState";
import { useTeamAttendance } from "./useTeamAttendance";
import { useTeamJoinPassword } from "./useTeamJoinPassword";
import { useTeamMembership } from "./useTeamMembership";
import { useTeamProfile } from "./useTeamProfile";

export function useTeamManagePage() {
  const {
    currentTeam,
    currentUser,
    teamDetailsById,
    ensureSessionReady,
    ensureTeamDetailLoaded,
    refreshSessionContext,
  } = useTeamContext();
  const { shouldHideCreationEntrances } = useMiniReviewStatus();
  const navMetrics = getCustomNavMetrics();

  const activeMode = ref<TeamManageMode>("profile");
  const submitting = ref(false);
  const usersById = ref<Record<number, BackendUser>>({});

  const currentMembers = computed<BackendTeamMember[]>(() => {
    const teamId = currentTeam.value?.id;
    return teamId ? teamDetailsById.value[teamId]?.members ?? [] : [];
  });
  const hasCurrentTeam = computed(() => !!currentTeam.value);
  // 管理页只承载当前球队的管理；创建/加入球队是独立二级页面，对已有球队的用户同样开放。
  const canManageCurrentTeam = computed(() => !!currentTeam.value?.canManageTeam);
  const isManagementBlocked = computed(() => hasCurrentTeam.value && !canManageCurrentTeam.value);
  const heroTitle = computed(() => (currentTeam.value ? currentTeam.value.name : "还没有球队"));
  const heroCopy = computed(() =>
    currentTeam.value ? "管理当前球队资料、队员和球队上下文。" : "创建一支球队，或搜索加入现有球队后再来管理。",
  );
  const pageStyle = computed(() => ({ paddingTop: `${navMetrics.pageTopPadding + 8}px` }));
  // 无球队空态里的创建入口同样受审核模式开关控制。
  const canShowCreateTeamEntry = computed(() => !shouldHideCreationEntrances.value);
  const modeOptions = computed<NeoSegmentOption[]>(() => [
    { label: "球队资料", value: "profile" },
    { label: "队员管理", value: "members" },
    { label: "比赛出勤", value: "attendance" },
  ]);

  const profile = useTeamProfile({ currentTeam, submitting, refreshSessionContext });
  const passwordPanel = useTeamJoinPassword({ currentTeam, submitting });
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

  function handleSelectMode(mode: TeamManageMode) {
    activeMode.value = mode;
    if (mode === "attendance") void attendance.loadTeamActivityAttendanceSummaries();
  }

  function handleModeChange(mode: string) {
    handleSelectMode(mode as TeamManageMode);
  }

  function goCreateTeam() {
    uni.navigateTo({ url: "/pages/teams/create/index" });
  }

  function goJoinTeam() {
    uni.navigateTo({ url: "/pages/teams/join/index" });
  }

  watch(() => currentTeam.value?.id, attendance.invalidateActivityAttendance);

  onShow(async () => {
    await ensureSessionReady();
    // 普通队员无管理权限：不加载管理数据，模板层展示无权限态。
    if (isManagementBlocked.value) return;
    if (currentTeam.value) await ensureTeamDetailLoaded(currentTeam.value.id);
    profile.syncTeamProfileForm();
    void passwordPanel.syncJoinPasswordStatus();
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
    canManageCurrentTeam,
    canShowCreateTeamEntry,
    submitting,
    usersById,
    heroTitle,
    heroCopy,
    pageStyle,
    modeOptions,
    formatAttendanceDate,
    handleModeChange,
    goCreateTeam,
    goJoinTeam,
    ...profile,
    ...passwordPanel,
    ...attendance,
    ...membership,
  };
}
