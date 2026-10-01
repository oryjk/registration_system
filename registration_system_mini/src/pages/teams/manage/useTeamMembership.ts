import { computed, reactive, ref, type ComputedRef, type Ref } from "vue";
import type { BackendTeamMember, BackendUser } from "@/types/backend";
import type { TeamProfileViewModel } from "@/types/viewModels";
import {
  addMemberToTeam,
  consumeTeamMemberFundFromForm,
  rechargeTeamMemberFundFromForm,
  removeMemberFromTeam,
  searchTeamCandidates,
  setTeamMemberStatus,
  updateTeamMemberFromForm,
  updateTeamMemberPaidMembershipFromForm,
} from "./teamManageActions";
import { splitTeamMembers } from "./teamManageState";

interface TeamMembershipDependencies {
  currentTeam: ComputedRef<TeamProfileViewModel | null>;
  currentUser: Ref<BackendUser | null>;
  currentMembers: ComputedRef<BackendTeamMember[]>;
  usersById: Ref<Record<number, BackendUser>>;
  submitting: Ref<boolean>;
  refreshSessionContext: () => Promise<void>;
  /** 强制重拉当前球队详情：成员变更后队员列表缓存在 teamDetailsById，不重拉会一直显示旧名单。 */
  refreshTeamDetail: (teamId: number) => Promise<unknown>;
  invalidateActivityAttendance: () => void;
}

/** 单笔人工动作上限（分），与后端 teamfund 上限一致（¥10000）。 */
const MAX_FUND_ACTION_CENTS = 1_000_000;

export type MemberFundActionMode = "recharge" | "consume";

export function useTeamMembership(dependencies: TeamMembershipDependencies) {
  const {
    currentTeam,
    currentUser,
    currentMembers,
    usersById,
    submitting,
    refreshSessionContext,
    refreshTeamDetail,
    invalidateActivityAttendance,
  } = dependencies;

  const userSearching = ref(false);
  const userSearchKeyword = ref("");
  const userSearchResults = ref<BackendUser[]>([]);
  const selectedCandidate = ref<BackendUser | null>(null);
  const editMemberPopupVisible = ref(false);
  const editingMemberId = ref<number | null>(null);
  const memberForm = reactive({ userId: "", role: "member" });
  const editMemberForm = reactive({
    role: "member",
    isPaidMember: false,
  });
  // 打开弹窗时的付费标记基线：与实时名单无关。若与最新名单比较，
  // 编辑期间真实充值自动标记的会员会被旧开关值回写覆盖。
  const editPaidBaseline = ref(false);
  // 队费动作（充值/消费扣费）：目标与幂等键在打开时固定，同一意图重试复用一键。
  const fundActionMode = ref<MemberFundActionMode | null>(null);
  const fundActionMemberId = ref<number | null>(null);
  const fundActionForm = reactive({ amountYuan: "", note: "" });
  const fundActionKey = ref("");

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

  function resetEditMemberState() {
    editMemberPopupVisible.value = false;
    editingMemberId.value = null;
    editMemberForm.role = "member";
    editMemberForm.isPaidMember = false;
    editPaidBaseline.value = false;
  }

  // 保存进行中禁止取消/关闭：保存流程会自行收尾，避免半途切换状态让后续请求读到错的编辑对象。
  function closeEditMemberPopup() {
    if (submitting.value) return;
    resetEditMemberState();
  }

  function handleEditMember(member: BackendTeamMember) {
    // 无管理权限或保存进行中禁止打开/切换编辑对象。
    if (!canManageMembers.value || submitting.value) return;
    editingMemberId.value = member.user_id;
    editMemberForm.role = member.role;
    editMemberForm.isPaidMember = !!member.is_paid_member;
    editPaidBaseline.value = !!member.is_paid_member;
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
      await refreshTeamDetail(currentTeam.value.id);
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
    if (!currentTeam.value || !canManageMembers.value || !editingMemberId.value || submitting.value) return;
    const member = editingMember.value;
    if (!member) return;
    // 保存目标与参数在此一次性固定：保存期间弹窗可能被关闭或列表刷新，
    // 请求只使用捕获值，严禁在 await 之后回读 editingMemberId / editMemberForm。
    const teamId = currentTeam.value.id;
    const userId = editingMemberId.value;
    const role = editMemberForm.role;
    const isPaidMember = editMemberForm.isPaidMember;
    // 付费会员标记与打开弹窗时的基线相比变了才提交；余额与充值时间由充值/消费动作维护。
    const paidChanged = isPaidMember !== editPaidBaseline.value;

    submitting.value = true;
    // 角色步骤可能先成功、后续步骤失败（典型：领队把自己降级后，付费标记请求 403）。
    // 已落库的角色不回滚也不能被笼统提示成全部失败：刷新会话与名单让页面回到真实状态。
    let roleUpdated = false;
    try {
      if (member.role !== "captain") {
        await updateTeamMemberFromForm(teamId, userId, { role });
        roleUpdated = true;
      }
      if (paidChanged) {
        await updateTeamMemberPaidMembershipFromForm(teamId, userId, { isPaidMember });
      }
      await refreshTeamDetail(teamId);
      await refreshSessionContext();
      invalidateActivityAttendance();
      resetEditMemberState();
      uni.showToast({ title: "队员已更新", icon: "none" });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "";
      if (roleUpdated) {
        // 部分成功：角色已保存（操作者可能已失去管理权限），刷新会话与名单同步权限；
        // 弹窗基线已过期，关闭以避免重试时重复提交已成功的角色步骤。
        await refreshTeamDetail(teamId).catch(() => undefined);
        await refreshSessionContext().catch(() => undefined);
        invalidateActivityAttendance();
        resetEditMemberState();
        uni.showToast({
          title: reason ? `角色已更新，付费会员状态未保存：${reason}` : "角色已更新，付费会员状态未保存",
          icon: "none",
        });
      } else {
        uni.showToast({ title: reason || "更新队员失败", icon: "none" });
      }
    } finally {
      submitting.value = false;
    }
  }

  const fundActionMember = computed(() =>
    fundActionMemberId.value ? currentMemberByUserId(fundActionMemberId.value) : null,
  );

  function resetFundActionState() {
    fundActionMode.value = null;
    fundActionMemberId.value = null;
    fundActionForm.amountYuan = "";
    fundActionForm.note = "";
    fundActionKey.value = "";
  }

  function closeFundActionPopup() {
    if (submitting.value) return;
    resetFundActionState();
  }

  function handleOpenFundAction(mode: MemberFundActionMode) {
    if (submitting.value || !canManageMembers.value || !editingMemberId.value) return;
    fundActionMode.value = mode;
    fundActionMemberId.value = editingMemberId.value;
    fundActionForm.amountYuan = "";
    fundActionForm.note = "";
    // 打开时生成幂等键：同一意图的失败重试复用一键，后端只记一笔。
    fundActionKey.value = generateIdempotencyKey();
  }

  function generateIdempotencyKey() {
    const globalCrypto = globalThis.crypto as { randomUUID?: () => string } | undefined;
    if (globalCrypto?.randomUUID) return globalCrypto.randomUUID();
    return `fund-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  async function handleSubmitFundAction() {
    if (!currentTeam.value || !canManageMembers.value || !fundActionMemberId.value || !fundActionMode.value || submitting.value) return;
    const mode = fundActionMode.value;
    // 目标与参数在此一次性固定，保存期间禁止切换（submitting 守卫）。
    const teamId = currentTeam.value.id;
    const userId = fundActionMemberId.value;
    const amountYuan = Number(fundActionForm.amountYuan);
    if (!Number.isFinite(amountYuan) || amountYuan <= 0) {
      uni.showToast({ title: "请输入正确的金额", icon: "none" });
      return;
    }
    const amountCents = Math.round(amountYuan * 100);
    if (amountCents > MAX_FUND_ACTION_CENTS) {
      uni.showToast({ title: "单笔不能超过 ¥10000，请拆分多笔", icon: "none" });
      return;
    }
    const note = fundActionForm.note.trim();
    if (mode === "consume" && !note) {
      uni.showToast({ title: "请填写消费原因", icon: "none" });
      return;
    }
    const idempotencyKey = fundActionKey.value || generateIdempotencyKey();
    fundActionKey.value = idempotencyKey;

    submitting.value = true;
    try {
      const action = mode === "recharge" ? rechargeTeamMemberFundFromForm : consumeTeamMemberFundFromForm;
      const result = await action(teamId, userId, { amountCents, note, idempotencyKey });
      await refreshTeamDetail(teamId);
      invalidateActivityAttendance();
      const balanceYuan = (result.balance_cents / 100).toFixed(2);
      uni.showToast({
        title: result.balance_cents < 0 ? `已提交，当前欠款 ¥${balanceYuan}` : `已提交，当前余额 ¥${balanceYuan}`,
        icon: "none",
      });
      resetFundActionState();
    } catch (error) {
      // 幂等重放（duplicated）后端也返回成功；这里仅提示失败场景，重试沿用同一幂等键。
      uni.showToast({ title: error instanceof Error ? error.message : "操作失败", icon: "none" });
    } finally {
      submitting.value = false;
    }
  }

  async function handleRemoveMember(member: BackendTeamMember) {
    if (!currentTeam.value || !canManageMembers.value || submitting.value) return;
    if (member.user_id === currentUser.value?.id) {
      uni.showToast({ title: "不能在这里移除自己", icon: "none" });
      return;
    }

    submitting.value = true;
    try {
      await removeMemberFromTeam(currentTeam.value.id, member.user_id);
      await refreshTeamDetail(currentTeam.value.id);
      await refreshSessionContext();
      invalidateActivityAttendance();
      if (editingMemberId.value === member.user_id) resetEditMemberState();
      uni.showToast({ title: "队员已移除", icon: "none" });
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "移除队员失败", icon: "none" });
    } finally {
      submitting.value = false;
    }
  }

  async function handleToggleMemberStatus(member: BackendTeamMember) {
    if (!currentTeam.value || !canManageMembers.value || submitting.value) return;
    const nextStatus = member.status === 1 ? 0 : 1;
    submitting.value = true;
    try {
      await setTeamMemberStatus(currentTeam.value.id, member.user_id, nextStatus);
      await refreshTeamDetail(currentTeam.value.id);
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
    fundActionMode,
    fundActionMember,
    fundActionForm,
    leadershipMembers,
    regularMembers,
    frozenMembers,
    isCurrentMember,
    isCaptainMember,
    candidateActionLabel,
    closeEditMemberPopup,
    closeFundActionPopup,
    handleEditMember,
    handleOpenFundAction,
    handleSubmitFundAction,
    handleSearchUsers,
    handleCandidateTap,
    handleAddMember,
    handleUpdateMember,
    handleRemoveMember,
    handleToggleMemberStatus,
  };
}
