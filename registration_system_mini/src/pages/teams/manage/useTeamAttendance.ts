import { computed, ref, type ComputedRef, type Ref } from "vue";
import type { BackendTeamMember, BackendTeamMemberAttendanceRecord, BackendUser } from "@/types/backend";
import type { TeamProfileViewModel } from "@/types/viewModels";
import { resolveUserDisplayName, toStandLabel } from "@/utils/viewModels";
import { loadTeamMemberAttendance } from "./teamManageActions";
import {
  attendanceStatusLabel as resolveAttendanceStatusLabel,
  buildAttendanceGroups,
  buildAttendanceSummary,
  buildTeamActivityAttendanceSummaries,
} from "./teamManageState";

interface TeamAttendanceDependencies {
  currentTeam: ComputedRef<TeamProfileViewModel | null>;
  currentMembers: ComputedRef<BackendTeamMember[]>;
  usersById: Ref<Record<number, BackendUser>>;
  ensureTeamDetailLoaded: (teamId: number) => Promise<unknown>;
}

export function useTeamAttendance({ currentTeam, currentMembers, usersById, ensureTeamDetailLoaded }: TeamAttendanceDependencies) {
  const attendancePopupVisible = ref(false);
  const attendanceLoading = ref(false);
  const attendanceMemberId = ref<number | null>(null);
  const attendanceRecords = ref<BackendTeamMemberAttendanceRecord[]>([]);
  const activityAttendanceLoading = ref(false);
  const activityAttendanceRecordsByUserId = ref<Record<number, BackendTeamMemberAttendanceRecord[]>>({});
  const collapsedAttendanceYears = ref<string[]>([]);

  const attendanceMember = computed(() =>
    attendanceMemberId.value
      ? currentMembers.value.find((member) => member.user_id === attendanceMemberId.value) ?? null
      : null,
  );
  const attendanceSummary = computed(() => buildAttendanceSummary(attendanceRecords.value));
  const attendanceGroups = computed(() => buildAttendanceGroups(attendanceRecords.value, collapsedAttendanceYears.value));
  const activityAttendanceSummaries = computed(() =>
    buildTeamActivityAttendanceSummaries(
      activityAttendanceRecordsByUserId.value,
      memberName,
      memberAvatarUrl,
      memberInitial,
    ),
  );

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
    activityAttendanceRecordsByUserId.value = {};
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
    if (!teamId || activityAttendanceLoading.value) return;
    activityAttendanceLoading.value = true;
    invalidateActivityAttendance();
    try {
      await ensureTeamDetailLoaded(teamId);
      const results = await Promise.all(
        currentMembers.value.map(async (member) => {
          const result = await loadTeamMemberAttendance(teamId, member.user_id);
          return [member.user_id, result.records] as const;
        }),
      );
      activityAttendanceRecordsByUserId.value = Object.fromEntries(results);
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "比赛出勤加载失败", icon: "none" });
    } finally {
      activityAttendanceLoading.value = false;
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
    activityAttendanceSummaries,
    memberName,
    memberAvatarUrl,
    memberInitial,
    attendanceStatusLabel,
    toggleAttendanceYear,
    invalidateActivityAttendance,
    closeAttendancePopup,
    handleOpenMemberAttendance,
    loadTeamActivityAttendanceSummaries,
  };
}
