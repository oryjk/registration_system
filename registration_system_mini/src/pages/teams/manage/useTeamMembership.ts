import { computed, reactive, ref, type ComputedRef, type Ref } from "vue";
import type { BackendTeamMember, BackendUser } from "@/types/backend";
import type { TeamProfileViewModel } from "@/types/viewModels";
import {
  addMemberToTeam,
  removeMemberFromTeam,
  searchTeamCandidates,
  setTeamMemberStatus,
  updateTeamMemberFromForm,
} from "./teamManageActions";
import { splitTeamMembers } from "./teamManageState";

interface TeamMembershipDependencies {
  currentTeam: ComputedRef<TeamProfileViewModel | null>;
  currentUser: Ref<BackendUser | null>;
  currentMembers: ComputedRef<BackendTeamMember[]>;
  usersById: Ref<Record<number, BackendUser>>;
  submitting: Ref<boolean>;
  refreshSessionContext: () => Promise<void>;
  invalidateActivityAttendance: () => void;
}

export function useTeamMembership(dependencies: TeamMembershipDependencies) {
  const {
    currentTeam,
    currentUser,
    currentMembers,
    usersById,
    submitting,
    refreshSessionContext,
    invalidateActivityAttendance,
  } = dependencies;

  const userSearching = ref(false);
  const userSearchKeyword = ref("");
  const userSearchResults = ref<BackendUser[]>([]);
  const selectedCandidate = ref<BackendUser | null>(null);
  const editMemberPopupVisible = ref(false);
  const editingMemberId = ref<number | null>(null);
  const memberForm = reactive({ userId: "", role: "member" });
  const editMemberForm = reactive({ role: "member" });

  const canManageMembers = computed(() => !!currentTeam.value?.canManageTeam);
  const groupedMembers = computed(() => splitTeamMembers(currentMembers.value));
  const leadershipMembers = computed(() => groupedMembers.value.leadershipMembers);
  const regularMembers = computed(() => groupedMembers.value.regularMembers);
  const frozenMembers = computed(() => groupedMembers.value.frozenMembers);
  const memberIds = computed(() => new Set(currentMembers.value.map((member) => member.user_id)));
  const editingMember = computed(() =>
    editingMemberId.value ? currentMemberByUserId(editingMemberId.value) : null,
  );

  function currentMemberByUserId(userId: number) {
    return currentMembers.value.find((member) => member.user_id === userId) ?? null;
  }

  function isCurrentMember(userId: number) {
    return memberIds.value.has(userId);
  }

  function isCaptainMember(userId: number) {
    return currentMemberByUserId(userId)?.role === "captain";
  }

  function candidateActionLabel(candidate: BackendUser) {
    if (isCaptainMember(candidate.id)) return "队长";
    if (isCurrentMember(candidate.id)) return "移除";
    return selectedCandidate.value?.id === candidate.id ? "已选择" : "选择";
  }

  function resetMemberForm() {
    selectedCandidate.value = null;
    userSearchKeyword.value = "";
    userSearchResults.value = [];
    memberForm.userId = "";
    memberForm.role = "member";
  }

  function closeEditMemberPopup() {
    editMemberPopupVisible.value = false;
    editingMemberId.value = null;
    editMemberForm.role = "member";
  }

  function handleEditMember(member: BackendTeamMember) {
    editingMemberId.value = member.user_id;
    editMemberForm.role = member.role;
    editMemberPopupVisible.value = true;
  }

  async function handleSearchUsers() {
    const keyword = userSearchKeyword.value.trim();
    if (!keyword) {
      uni.showToast({ title: "请输入昵称或姓名", icon: "none" });
      return;
    }

    userSearching.value = true;
    selectedCandidate.value = null;
    memberForm.userId = "";
    try {
      const users = await searchTeamCandidates(keyword, 8);
      userSearchResults.value = users;
      usersById.value = { ...usersById.value, ...Object.fromEntries(users.map((user) => [user.id, user])) };
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "搜索用户失败", icon: "none" });
    } finally {
      userSearching.value = false;
    }
  }

  async function handleCandidateTap(candidate: BackendUser) {
    const existingMember = currentMemberByUserId(candidate.id);
    if (existingMember) {
      if (existingMember.role === "captain") {
        uni.showToast({ title: "不能移除队长", icon: "none" });
        return;
      }
      await handleRemoveMember(existingMember);
      return;
    }

    selectedCandidate.value = candidate;
    memberForm.userId = String(candidate.id);
    usersById.value = { ...usersById.value, [candidate.id]: candidate };
  }

  async function handleAddMember() {
    if (!currentTeam.value || !canManageMembers.value || submitting.value) return;
    const userId = Number(memberForm.userId);
    if (!userId) {
      uni.showToast({ title: "请选择队员", icon: "none" });
      return;
    }

    submitting.value = true;
    try {
      await addMemberToTeam(currentTeam.value.id, {
        userId,
        role: memberForm.role,
      });
      await refreshSessionContext();
      invalidateActivityAttendance();
      resetMemberForm();
      uni.showToast({ title: "队员已添加", icon: "none" });
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "添加队员失败", icon: "none" });
    } finally {
      submitting.value = false;
    }
  }

  async function handleUpdateMember() {
    if (!currentTeam.value || !editingMemberId.value || submitting.value) return;
    submitting.value = true;
    try {
      await updateTeamMemberFromForm(currentTeam.value.id, editingMemberId.value, {
        role: editMemberForm.role,
      });
      await refreshSessionContext();
      invalidateActivityAttendance();
      closeEditMemberPopup();
      uni.showToast({ title: "队员已更新", icon: "none" });
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "更新队员失败", icon: "none" });
    } finally {
      submitting.value = false;
    }
  }

  async function handleRemoveMember(member: BackendTeamMember) {
    if (!currentTeam.value || submitting.value) return;
    if (member.user_id === currentUser.value?.id) {
      uni.showToast({ title: "不能在这里移除自己", icon: "none" });
      return;
    }

    submitting.value = true;
    try {
      await removeMemberFromTeam(currentTeam.value.id, member.user_id);
      await refreshSessionContext();
      invalidateActivityAttendance();
      if (editingMemberId.value === member.user_id) closeEditMemberPopup();
      uni.showToast({ title: "队员已移除", icon: "none" });
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "移除队员失败", icon: "none" });
    } finally {
      submitting.value = false;
    }
  }

  async function handleToggleMemberStatus(member: BackendTeamMember) {
    if (!currentTeam.value || submitting.value) return;
    const nextStatus = member.status === 1 ? 0 : 1;
    submitting.value = true;
    try {
      await setTeamMemberStatus(currentTeam.value.id, member.user_id, nextStatus);
      await refreshSessionContext();
      invalidateActivityAttendance();
      uni.showToast({ title: nextStatus === 1 ? "队员已恢复" : "队员已冻结", icon: "none" });
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "状态更新失败", icon: "none" });
    } finally {
      submitting.value = false;
    }
  }

  return {
    canManageMembers,
    userSearching,
    userSearchKeyword,
    userSearchResults,
    selectedCandidate,
    editMemberPopupVisible,
    memberForm,
    editMemberForm,
    editingMember,
    leadershipMembers,
    regularMembers,
    frozenMembers,
    isCurrentMember,
    isCaptainMember,
    candidateActionLabel,
    closeEditMemberPopup,
    handleEditMember,
    handleSearchUsers,
    handleCandidateTap,
    handleAddMember,
    handleUpdateMember,
    handleRemoveMember,
    handleToggleMemberStatus,
  };
}
