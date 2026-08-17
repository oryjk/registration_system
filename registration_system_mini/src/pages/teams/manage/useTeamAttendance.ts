import { computed, ref, type ComputedRef, type Ref } from "vue";
import type {
  BackendTeamMember,
  BackendTeamMemberAttendanceRecord,
  BackendTeamMatchAttendance,
  BackendUser,
} from "@/types/backend";
import type { TeamProfileViewModel } from "@/types/viewModels";
import { resolveUserDisplayName, toStandLabel } from "@/utils/viewModels";
import { loadTeamMatchAttendance, loadTeamMemberAttendance } from "./teamManageActions";
import {
  attendanceStatusLabel as resolveAttendanceStatusLabel,
  buildAttendanceGroups,
  buildAttendanceSummary,
} from "./teamManageState";

interface MatchAttendanceState {
  loading: boolean;
  detail: BackendTeamMatchAttendance | null;
}

interface TeamAttendanceDependencies {
  currentTeam: ComputedRef<TeamProfileViewModel | null>;
  currentUser: Ref<BackendUser | null>;
  currentMembers: ComputedRef<BackendTeamMember[]>;
  usersById: Ref<Record<number, BackendUser>>;
  ensureTeamDetailLoaded: (teamId: number) => Promise<unknown>;
}

export function useTeamAttendance({ currentTeam, currentUser, currentMembers, usersById, ensureTeamDetailLoaded }: TeamAttendanceDependencies) {
  const attendancePopupVisible = ref(false);
  const attendanceLoading = ref(false);
  const attendanceMemberId = ref<number | null>(null);
  const attendanceRecords = ref<BackendTeamMemberAttendanceRecord[]>([]);
  const collapsedAttendanceYears = ref<string[]>([]);

  // 比赛出勤改为懒加载：列表只拉当前管理者的比赛行（一次请求），
  // 展开某场时才调单场出勤接口。
  const activityAttendanceLoading = ref(false);
  const activityMatches = ref<BackendTeamMemberAttendanceRecord[]>([]);
  const expandedActivityId = ref<string | null>(null);
  const matchAttendanceById = ref<Record<string, MatchAttendanceState>>({});

  const attendanceMember = computed(() =>
    attendanceMemberId.value
      ? currentMembers.value.find((member) => member.user_id === attendanceMemberId.value) ?? null
      : null,
  );
  const attendanceSummary = computed(() => buildAttendanceSummary(attendanceRecords.value));
  const attendanceGroups = computed(() => buildAttendanceGroups(attendanceRecords.value, collapsedAttendanceYears.value));

  // 队员资料优先用 usersById（完整用户对象），缺失时回退到队员列表自带的昵称/头像。
  function memberProfile(userId: number): BackendTeamMember | undefined {
    return currentMembers.value.find((member) => member.user_id === userId);
  }

  function memberName(userId: number) {
    const user = usersById.value[userId];
    if (user) {
      return resolveUserDisplayName(user);
    }
    // 与 resolveUserDisplayName 语义一致：真名优先，昵称兜底。
    const member = memberProfile(userId);
    return member?.real_name?.trim() || member?.nickname?.trim() || `队员 ${userId}`;
  }

  function memberAvatarUrl(userId: number) {
    return (
      usersById.value[userId]?.avatar_url?.trim()
      || memberProfile(userId)?.avatar_url?.trim()
      || ""
    );
  }

  function memberInitial(userId: number) {
    return memberName(userId).slice(0, 1) || "队";
  }

  function attendanceStatusLabel(record: BackendTeamMemberAttendanceRecord) {
    return resolveAttendanceStatusLabel(record, toStandLabel);
  }

  function toggleAttendanceYear(year: string) {
    collapsedAttendanceYears.value = collapsedAttendanceYears.value.includes(year)
      ? collapsedAttendanceYears.value.filter((item) => item !== year)
      : [...collapsedAttendanceYears.value, year];
  }

  function invalidateActivityAttendance() {
    activityMatches.value = [];
    expandedActivityId.value = null;
    matchAttendanceById.value = {};
  }

  function closeAttendancePopup() {
    attendancePopupVisible.value = false;
    attendanceMemberId.value = null;
    attendanceRecords.value = [];
    collapsedAttendanceYears.value = [];
  }

  async function handleOpenMemberAttendance(member: BackendTeamMember) {
    if (!currentTeam.value || attendanceLoading.value) return;
    attendanceMemberId.value = member.user_id;
    attendancePopupVisible.value = true;
    attendanceLoading.value = true;
    attendanceRecords.value = [];
    collapsedAttendanceYears.value = [];
    try {
      const result = await loadTeamMemberAttendance(currentTeam.value.id, member.user_id);
      attendanceRecords.value = result.records;
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "出场记录加载失败", icon: "none" });
    } finally {
      attendanceLoading.value = false;
    }
  }

  async function loadTeamActivityAttendanceSummaries() {
    const teamId = currentTeam.value?.id;
    const userId = currentUser.value?.id;
    if (!teamId || !userId || activityAttendanceLoading.value) return;
    activityAttendanceLoading.value = true;
    try {
      await ensureTeamDetailLoaded(teamId);
      // 管理者本人的出勤记录天然包含球队全部有效比赛（未报名也有行），作为比赛列表。
      const result = await loadTeamMemberAttendance(teamId, userId);
      activityMatches.value = result.records;
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "比赛出勤加载失败", icon: "none" });
    } finally {
      activityAttendanceLoading.value = false;
    }
  }

  async function toggleActivityMatch(activityId: string) {
    if (expandedActivityId.value === activityId) {
      expandedActivityId.value = null;
      return;
    }
    expandedActivityId.value = activityId;
    const teamId = currentTeam.value?.id;
    if (!teamId || matchAttendanceById.value[activityId]) return;

    matchAttendanceById.value = { ...matchAttendanceById.value, [activityId]: { loading: true, detail: null } };
    try {
      const detail = await loadTeamMatchAttendance(teamId, activityId);
      matchAttendanceById.value = { ...matchAttendanceById.value, [activityId]: { loading: false, detail } };
    } catch (error) {
      matchAttendanceById.value = { ...matchAttendanceById.value, [activityId]: { loading: false, detail: null } };
      uni.showToast({ title: error instanceof Error ? error.message : "出勤明细加载失败", icon: "none" });
    }
  }

  return {
    attendancePopupVisible,
    attendanceLoading,
    attendanceRecords,
    attendanceMember,
    attendanceSummary,
    attendanceGroups,
    activityAttendanceLoading,
    activityMatches,
    expandedActivityId,
    matchAttendanceById,
    memberName,
    memberAvatarUrl,
    memberInitial,
    attendanceStatusLabel,
    toggleAttendanceYear,
    invalidateActivityAttendance,
    closeAttendancePopup,
    handleOpenMemberAttendance,
    loadTeamActivityAttendanceSummaries,
    toggleActivityMatch,
  };
}
