<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import MemberAttendancePopup from "./components/MemberAttendancePopup.vue";
import MemberEditPopup from "./components/MemberEditPopup.vue";
import TeamCreatePanel from "./components/TeamCreatePanel.vue";
import TeamJoinPanel from "./components/TeamJoinPanel.vue";
import TeamMemberManager from "./components/TeamMemberManager.vue";
import TeamProfilePanel from "./components/TeamProfilePanel.vue";
import {
  addMemberToTeam,
  checkTeamRequiresPassword,
  createTeamFromForm,
  joinTeamFromForm,
  loadTeamMemberAttendance,
  loadUsersById,
  removeMemberFromTeam,
  saveTeamProfile,
  searchTeamCandidates,
  searchTeamsByKeyword,
  setTeamMemberStatus,
  updateTeamMemberFromForm,
  uploadCurrentTeamLogo,
} from "./teamManageActions";
import { useTeamContext } from "@/stores/teamContext";
import type { BackendTeamMember, BackendTeamMemberAttendanceRecord, BackendTeamSummary, BackendUser } from "@/types/backend";
import { MINI_PROGRAM_VERSION } from "@/config/generatedMiniProgramVersion";
import { getCustomNavMetrics } from "@/utils/customNav";
import { resolveUserDisplayName, toStandLabel } from "@/utils/viewModels";
import {
  attendanceStatusClass,
  attendanceStatusLabel as resolveAttendanceStatusLabel,
  buildAttendanceGroups,
  buildAttendanceSummary,
  formatAttendanceDate,
  resolveVisibleMode,
  splitTeamMembers,
  type TeamManageMode,
} from "./teamManageState";
import { preloadMiniReviewStatus, useMiniReviewStatus } from "@/stores/miniReview";

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
const userSearching = ref(false);
const searchKeyword = ref("");
const searchResults = ref<BackendTeamSummary[]>([]);
const selectedTeam = ref<BackendTeamSummary | null>(null);
const selectedTeamRequiresPassword = ref(false);
const joinPassword = ref("");
const usersById = ref<Record<number, BackendUser>>({});
const userSearchKeyword = ref("");
const userSearchResults = ref<BackendUser[]>([]);
const selectedCandidate = ref<BackendUser | null>(null);
const editMemberPopupVisible = ref(false);
const editingMemberId = ref<number | null>(null);
const attendancePopupVisible = ref(false);
const attendanceLoading = ref(false);
const attendanceMemberId = ref<number | null>(null);
const attendanceRecords = ref<BackendTeamMemberAttendanceRecord[]>([]);
const collapsedAttendanceYears = ref<string[]>([]);
const logoUploading = ref(false);
const maxLogoSizeBytes = 1024 * 1024;
const reviewTeamNameOptions = ["星火联队", "周末竞技 FC", "白银风暴", "东城野球会", "黑曜九号"];
const createTeamReviewMode = reviewMode;

const teamProfileForm = reactive({
  name: "",
  description: "",
  logoUrl: "",
});

const createForm = reactive({
  name: "",
  description: "",
  joinPassword: "",
});

const memberForm = reactive({
  userId: "",
  role: "member",
  jerseyNumber: "",
  isMember: false,
});
const editMemberForm = reactive({
  role: "member",
  jerseyNumber: "",
  isMember: false,
});
const canCreate = computed(() => !!createForm.name.trim() && !submitting.value);
const canJoin = computed(() => !!selectedTeam.value && !submitting.value);
const canManageMembers = computed(() => !!currentTeam.value?.canManageTeam);
const canUpdateTeamProfile = computed(() => !!currentTeam.value?.canManageTeam && !!teamProfileForm.name.trim() && !submitting.value);
const hasCurrentTeam = computed(() => !!currentTeam.value);
const heroTitle = computed(() => (currentTeam.value ? currentTeam.value.name : "创建或加入一支球队"));
const heroCopy = computed(() =>
  currentTeam.value ? "管理当前球队资料、队员和球队上下文。" : "球队会影响首页、约队、统计和报名上下文。",
);
const currentMembers = computed<BackendTeamMember[]>(() => {
  const teamId = currentTeam.value?.id;
  return teamId ? teamDetailsById.value[teamId]?.members ?? [] : [];
});
const groupedMembers = computed(() => splitTeamMembers(currentMembers.value));
const leadershipMembers = computed(() => groupedMembers.value.leadershipMembers);
const regularMembers = computed(() => groupedMembers.value.regularMembers);
const frozenMembers = computed(() => groupedMembers.value.frozenMembers);

const memberIds = computed(() => new Set(currentMembers.value.map((member) => member.user_id)));
const editingMember = computed(() => (editingMemberId.value ? currentMemberByUserId(editingMemberId.value) : null));
const attendanceMember = computed(() => (attendanceMemberId.value ? currentMemberByUserId(attendanceMemberId.value) : null));
const attendanceSummary = computed(() => buildAttendanceSummary(attendanceRecords.value));
const attendanceGroups = computed(() => buildAttendanceGroups(attendanceRecords.value, collapsedAttendanceYears.value));
const pageStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));
const canShowCreateTeamEntry = computed(() => !shouldHideCreationEntrances.value);

function syncVisibleMode() {
  activeMode.value = resolveVisibleMode(hasCurrentTeam.value, activeMode.value, canShowCreateTeamEntry.value);
}

watch(hasCurrentTeam, () => {
  syncVisibleMode();
});

function resetJoinSelection() {
  selectedTeam.value = null;
  selectedTeamRequiresPassword.value = false;
  joinPassword.value = "";
}

function attendanceStatusLabel(record: BackendTeamMemberAttendanceRecord) {
  return resolveAttendanceStatusLabel(record, toStandLabel);
}

function toggleAttendanceYear(year: string) {
  if (collapsedAttendanceYears.value.includes(year)) {
    collapsedAttendanceYears.value = collapsedAttendanceYears.value.filter((item) => item !== year);
  } else {
    collapsedAttendanceYears.value = [...collapsedAttendanceYears.value, year];
  }
}

function memberName(userId: number) {
  return resolveUserDisplayName(usersById.value[userId]);
}

function memberAvatarUrl(userId: number) {
  return usersById.value[userId]?.avatar_url?.trim() || "";
}

function memberInitial(userId: number) {
  return memberName(userId).slice(0, 1) || "队";
}

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
  memberForm.jerseyNumber = "";
  memberForm.isMember = false;
}

function closeEditMemberPopup() {
  editMemberPopupVisible.value = false;
  editingMemberId.value = null;
  editMemberForm.role = "member";
  editMemberForm.jerseyNumber = "";
  editMemberForm.isMember = false;
}

function closeAttendancePopup() {
  attendancePopupVisible.value = false;
  attendanceMemberId.value = null;
  attendanceRecords.value = [];
  collapsedAttendanceYears.value = [];
}

function syncTeamProfileForm() {
  teamProfileForm.name = currentTeam.value?.name ?? "";
  teamProfileForm.description = currentTeam.value?.description ?? "";
  teamProfileForm.logoUrl = currentTeam.value?.logoUrl ?? "";
}

async function hydrateCreateTeamReviewMode() {
  await preloadMiniReviewStatus();
  if (createTeamReviewMode.value && !reviewTeamNameOptions.includes(createForm.name)) {
    createForm.name = reviewTeamNameOptions[0] || "";
    createForm.description = "";
  }
}

async function getFileSize(filePath: string) {
  const info = await uni.getFileInfo({ filePath });
  return info.size ?? 0;
}

async function compressLogo(filePath: string) {
  const result = await uni.compressImage({
    src: filePath,
    quality: 75,
  });
  return result.tempFilePath || filePath;
}

async function resolveUploadableLogoPath(filePath: string) {
  const originalSize = await getFileSize(filePath);
  if (originalSize <= maxLogoSizeBytes) return filePath;

  const compressedPath = await compressLogo(filePath);
  const compressedSize = await getFileSize(compressedPath);
  if (compressedSize <= maxLogoSizeBytes) return compressedPath;

  throw new Error("球队 Logo 不能超过 1MB，请换一张图片");
}

async function handleChooseTeamLogo() {
  if (!currentTeam.value || logoUploading.value) return;

  try {
    const result = await uni.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      sourceType: ["album", "camera"],
    });
    const filePath = result.tempFilePaths?.[0] || "";
    if (!filePath) return;

    logoUploading.value = true;
    uni.showLoading({ title: "上传 Logo 中...", mask: true });
    const uploadPath = await resolveUploadableLogoPath(filePath);
    const uploaded = await uploadCurrentTeamLogo(currentTeam.value.id, uploadPath);
    teamProfileForm.logoUrl = uploaded.logo_url;
    await refreshSessionContext();
    syncTeamProfileForm();
    uni.hideLoading();
    uni.showToast({ title: "Logo 已上传", icon: "none" });
  } catch (error) {
    uni.hideLoading();
    uni.showToast({ title: error instanceof Error ? error.message : "Logo 上传失败", icon: "none" });
  } finally {
    logoUploading.value = false;
  }
}

function handleEditMember(member: BackendTeamMember) {
  editingMemberId.value = member.user_id;
  editMemberForm.role = member.role;
  editMemberForm.jerseyNumber = member.jersey_number ?? "";
  editMemberForm.isMember = member.is_member;
  editMemberPopupVisible.value = true;
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

async function handleUpdateTeamProfile() {
  if (!currentTeam.value || !canUpdateTeamProfile.value) {
    uni.showToast({ title: "请先补全球队名称", icon: "none" });
    return;
  }

  submitting.value = true;
  try {
    await saveTeamProfile(currentTeam.value.id, {
      name: teamProfileForm.name.trim(),
      description: teamProfileForm.description.trim() || null,
      logoUrl: teamProfileForm.logoUrl.trim() || null,
    });
    await refreshSessionContext();
    syncTeamProfileForm();
    uni.showToast({ title: "球队资料已保存", icon: "none" });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "保存球队资料失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
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
    usersById.value = {
      ...usersById.value,
      ...Object.fromEntries(users.map((user) => [user.id, user])),
    };
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
  usersById.value = {
    ...usersById.value,
    [candidate.id]: candidate,
  };
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
    await joinTeamFromForm({
      teamId: selectedTeam.value.id,
      password: joinPassword.value.trim() || undefined,
    });
    await refreshSessionContext();
    uni.showToast({ title: "已加入球队", icon: "none" });
    uni.switchTab({ url: "/pages/user/index" });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "加入球队失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
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
      jerseyNumber: memberForm.jerseyNumber.trim() || undefined,
      isMember: memberForm.isMember,
    });
    await refreshSessionContext();
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
      jerseyNumber: editMemberForm.jerseyNumber.trim() || null,
      isMember: editMemberForm.isMember,
    });
    await refreshSessionContext();
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
    if (editingMemberId.value === member.user_id) {
      closeEditMemberPopup();
    }
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
    uni.showToast({ title: nextStatus === 1 ? "队员已恢复" : "队员已冻结", icon: "none" });
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "状态更新失败", icon: "none" });
  } finally {
    submitting.value = false;
  }
}

onShow(async () => {
  await ensureSessionReady();
  if (currentTeam.value) {
    await ensureTeamDetailLoaded(currentTeam.value.id);
  }
  syncVisibleMode();
  syncTeamProfileForm();
  await hydrateCreateTeamReviewMode();
  try {
    usersById.value = await loadUsersById();
  } catch (_error) {
    usersById.value = {};
  }
});
</script>

<template>
  <page-meta :page-style="attendancePopupVisible ? 'overflow: hidden;' : ''" />
  <view class="team-manage-page" :style="pageStyle">
    <AppTabHeader title="球队管理" showBack />

    <view class="team-manage-hero">
      <text class="team-manage-kicker">球队管理</text>
      <text class="team-manage-title">{{ heroTitle }}</text>
      <text class="team-manage-copy">{{ heroCopy }}</text>
    </view>

    <view class="mode-switch">
      <template v-if="hasCurrentTeam">
        <view :class="['mode-chip', activeMode === 'profile' ? 'mode-chip-active' : '']" @tap="activeMode = 'profile'">球队资料</view>
        <view :class="['mode-chip', activeMode === 'members' ? 'mode-chip-active' : '']" @tap="activeMode = 'members'">队员管理</view>
      </template>
      <template v-else>
        <view v-if="canShowCreateTeamEntry" :class="['mode-chip', activeMode === 'create' ? 'mode-chip-active' : '']" @tap="activeMode = 'create'">创建球队</view>
        <view :class="['mode-chip', activeMode === 'join' ? 'mode-chip-active' : '']" @tap="activeMode = 'join'">加入球队</view>
      </template>
    </view>

    <TeamProfilePanel
      v-if="activeMode === 'profile'"
      :current-team="currentTeam"
      :can-manage-members="canManageMembers"
      :form="teamProfileForm"
      :logo-uploading="logoUploading"
      :can-update="canUpdateTeamProfile"
      :submitting="submitting"
      @choose-logo="handleChooseTeamLogo"
      @submit="handleUpdateTeamProfile"
    />

    <TeamCreatePanel
      v-else-if="activeMode === 'create'"
      :form="createForm"
      :review-mode="createTeamReviewMode"
      :review-team-name-options="reviewTeamNameOptions"
      :can-create="canCreate"
      :submitting="submitting"
      @submit="handleCreateTeam"
    />

    <TeamJoinPanel
      v-else-if="activeMode === 'join'"
      v-model:search-keyword="searchKeyword"
      v-model:join-password="joinPassword"
      :searching="searching"
      :search-results="searchResults"
      :selected-team="selectedTeam"
      :selected-team-requires-password="selectedTeamRequiresPassword"
      :can-join="canJoin"
      :submitting="submitting"
      @search="handleSearchTeams"
      @select-team="handleSelectTeam"
      @join="handleJoinTeam"
    />

    <TeamMemberManager
      v-else
      :current-team="currentTeam"
      :can-manage-members="canManageMembers"
      v-model:user-search-keyword="userSearchKeyword"
      :user-searching="userSearching"
      :user-search-results="userSearchResults"
      :selected-candidate="selectedCandidate"
      :member-form="memberForm"
      :leadership-members="leadershipMembers"
      :regular-members="regularMembers"
      :frozen-members="frozenMembers"
      :submitting="submitting"
      :member-name="memberName"
      :member-avatar-url="memberAvatarUrl"
      :member-initial="memberInitial"
      :is-current-member="isCurrentMember"
      :is-captain-member="isCaptainMember"
      :candidate-action-label="candidateActionLabel"
      @search-users="handleSearchUsers"
      @candidate-tap="handleCandidateTap"
      @add-member="handleAddMember"
      @open-member-attendance="handleOpenMemberAttendance"
      @edit-member="handleEditMember"
      @toggle-member-status="handleToggleMemberStatus"
      @remove-member="handleRemoveMember"
    />

    <MemberEditPopup
      v-model="editMemberPopupVisible"
      :member="editingMember"
      :member-name="editingMember ? memberName(editingMember.user_id) : '队员'"
      :form="editMemberForm"
      :submitting="submitting"
      @close="closeEditMemberPopup"
      @submit="handleUpdateMember"
    />

    <MemberAttendancePopup
      v-model="attendancePopupVisible"
      :member="attendanceMember"
      :member-name="attendanceMember ? memberName(attendanceMember.user_id) : '队员'"
      :member-avatar-url="attendanceMember ? memberAvatarUrl(attendanceMember.user_id) : ''"
      :member-initial="attendanceMember ? memberInitial(attendanceMember.user_id) : '队'"
      :loading="attendanceLoading"
      :records="attendanceRecords"
      :summary="attendanceSummary"
      :groups="attendanceGroups"
      :format-attendance-date="formatAttendanceDate"
      :attendance-status-class="attendanceStatusClass"
      :attendance-status-label="attendanceStatusLabel"
      @close="closeAttendancePopup"
      @toggle-year="toggleAttendanceYear"
    />
  </view>
</template>

<style scoped>
.team-manage-page {
  min-height: 100vh;
  padding: 34rpx 28rpx 96rpx;
  background: linear-gradient(180deg, #fbfcf7 0%, #eef2e6 100%);
  box-sizing: border-box;
}

.team-manage-hero {
  border-radius: 32rpx;
  background: #ffffff;
  box-shadow: 0 18rpx 36rpx rgba(16, 17, 15, 0.06);
}

.team-manage-hero {
  padding: 34rpx 30rpx;
}

.team-manage-kicker,
.team-manage-copy {
  color: #6a7165;
  font-size: 24rpx;
  font-weight: 700;
}

.team-manage-title {
  display: block;
  color: #10110f;
  font-weight: 900;
}

.team-manage-title {
  margin-top: 10rpx;
  font-size: 52rpx;
  line-height: 1.08;
}

.team-manage-copy {
  display: block;
  margin-top: 14rpx;
}

.mode-switch {
  display: flex;
  gap: 12rpx;
  margin: 24rpx 0;
  padding: 8rpx;
  border-radius: 999rpx;
  background: #e8ecdf;
}

.mode-chip {
  flex: 1;
  height: 70rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #5d6458;
  font-size: 26rpx;
  font-weight: 900;
}

.mode-chip {
  min-width: 0;
}

.mode-chip-active {
  background: #10110f;
  color: #c8ff00;
}
</style>
