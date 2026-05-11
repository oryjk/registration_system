<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import { onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import {
  addTeamMember,
  batchUpdateTeamMemberStatus,
  createTeam,
  getTeamPasswordInfo,
  joinTeam,
  removeTeamMember,
  searchTeams,
  updateTeam,
  updateTeamMember,
  uploadTeamLogo,
} from "@/api/team";
import { useTeamContext } from "@/stores/teamContext";
import { listUsers, searchUsers } from "@/api/user";
import type { BackendTeamMember, BackendTeamSummary, BackendUser } from "@/types/backend";
import { getCustomNavMetrics } from "@/utils/customNav";
import { resolveUserDisplayName } from "@/utils/viewModels";

const { currentTeam, currentUser, teamDetailsById, ensureSessionReady, refreshSessionContext } = useTeamContext();
const navMetrics = getCustomNavMetrics();

const activeMode = ref<"profile" | "create" | "join" | "members">("profile");
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
const logoUploading = ref(false);
const maxLogoSizeBytes = 1024 * 1024;

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
});
const editMemberForm = reactive({
  role: "member",
  jerseyNumber: "",
});
const memberRoleOptions = [
  { value: "member", label: "队员" },
  { value: "vice_captain", label: "队务" },
  { value: "leader", label: "领队" },
  { value: "captain", label: "队长" },
];

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

const memberIds = computed(() => new Set(currentMembers.value.map((member) => member.user_id)));
const editingMember = computed(() => (editingMemberId.value ? currentMemberByUserId(editingMemberId.value) : null));
const pageStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));

function syncVisibleMode() {
  if (hasCurrentTeam.value && (activeMode.value === "create" || activeMode.value === "join")) {
    activeMode.value = "profile";
    return;
  }

  if (!hasCurrentTeam.value && (activeMode.value === "profile" || activeMode.value === "members")) {
    activeMode.value = "create";
  }
}

watch(hasCurrentTeam, () => {
  syncVisibleMode();
});

function resetJoinSelection() {
  selectedTeam.value = null;
  selectedTeamRequiresPassword.value = false;
  joinPassword.value = "";
}

function roleLabel(role: string) {
  return memberRoleOptions.find((item) => item.value === role)?.label ?? "队员";
}

function memberStatusLabel(status: number) {
  return status === 1 ? "正常" : "已冻结";
}

function memberName(userId: number) {
  return resolveUserDisplayName(usersById.value[userId]);
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
}

function closeEditMemberPopup() {
  editMemberPopupVisible.value = false;
  editingMemberId.value = null;
  editMemberForm.role = "member";
  editMemberForm.jerseyNumber = "";
}

function syncTeamProfileForm() {
  teamProfileForm.name = currentTeam.value?.name ?? "";
  teamProfileForm.description = currentTeam.value?.description ?? "";
  teamProfileForm.logoUrl = currentTeam.value?.logoUrl ?? "";
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
    const uploaded = await uploadTeamLogo(currentTeam.value.id, uploadPath);
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
  editMemberPopupVisible.value = true;
}

async function handleUpdateTeamProfile() {
  if (!currentTeam.value || !canUpdateTeamProfile.value) {
    uni.showToast({ title: "请先补全球队名称", icon: "none" });
    return;
  }

  submitting.value = true;
  try {
    await updateTeam(currentTeam.value.id, {
      name: teamProfileForm.name.trim(),
      description: teamProfileForm.description.trim() || null,
      logo_url: teamProfileForm.logoUrl.trim() || null,
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
    const users = await searchUsers(keyword, 8);
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
    await createTeam({
      name: createForm.name.trim(),
      description: createForm.description.trim() || undefined,
      join_password: createForm.joinPassword.trim() || undefined,
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
    searchResults.value = await searchTeams(keyword);
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
    const info = await getTeamPasswordInfo(team.id);
    selectedTeamRequiresPassword.value = info.requires_password;
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
    await joinTeam({
      team_id: selectedTeam.value.id,
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
    await addTeamMember(currentTeam.value.id, {
      user_id: userId,
      role: memberForm.role,
      jersey_number: memberForm.jerseyNumber.trim() || undefined,
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
    await updateTeamMember(currentTeam.value.id, editingMemberId.value, {
      role: editMemberForm.role,
      jersey_number: editMemberForm.jerseyNumber.trim() || null,
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
    await removeTeamMember(currentTeam.value.id, member.user_id);
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
    await batchUpdateTeamMemberStatus(currentTeam.value.id, {
      user_ids: [member.user_id],
      status: nextStatus,
    });
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
  syncVisibleMode();
  syncTeamProfileForm();
  try {
    const users = await listUsers();
    usersById.value = Object.fromEntries(users.map((user) => [user.id, user]));
  } catch (_error) {
    usersById.value = {};
  }
});
</script>

<template>
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
        <view :class="['mode-chip', activeMode === 'create' ? 'mode-chip-active' : '']" @tap="activeMode = 'create'">创建球队</view>
        <view :class="['mode-chip', activeMode === 'join' ? 'mode-chip-active' : '']" @tap="activeMode = 'join'">加入球队</view>
      </template>
    </view>

    <view v-if="activeMode === 'profile'" class="form-card">
      <text class="form-title">当前球队资料</text>
      <view v-if="!currentTeam" class="empty-box">请先创建或加入球队。</view>
      <view v-else-if="!canManageMembers" class="empty-box">只有队长或领队可以修改球队资料。</view>
      <view v-else>
        <view class="form-field">
          <text class="form-label">球队名称</text>
          <input v-model="teamProfileForm.name" class="form-input" placeholder="输入球队名称" />
        </view>
        <view class="form-field">
          <text class="form-label">球队 Logo</text>
          <view class="team-logo-field">
            <view class="team-logo-preview">
              <image v-if="teamProfileForm.logoUrl" class="team-logo-image" :src="teamProfileForm.logoUrl" mode="aspectFill" />
              <text v-else class="team-logo-fallback">{{ currentTeam?.name?.slice(0, 1) || "队" }}</text>
            </view>
            <view class="team-logo-main">
              <view class="team-logo-button" @tap="handleChooseTeamLogo">
                {{ logoUploading ? "上传中..." : "选择图片上传" }}
              </view>
              <text class="team-logo-note">支持 jpg/png/webp，超过 1MB 会先尝试压缩。</text>
            </view>
          </view>
        </view>
        <view class="form-field">
          <text class="form-label">球队介绍</text>
          <textarea v-model="teamProfileForm.description" class="form-textarea" placeholder="球队风格、城市或活动时间" />
        </view>
        <view :class="['primary-button', canUpdateTeamProfile ? '' : 'primary-button-disabled']" @tap="handleUpdateTeamProfile">
          {{ submitting ? "保存中..." : "保存球队资料" }}
        </view>
      </view>
    </view>

    <view v-else-if="activeMode === 'create'" class="form-card">
      <text class="form-title">新球队资料</text>
      <view class="form-field">
        <text class="form-label">球队名称</text>
        <input v-model="createForm.name" class="form-input" placeholder="例如：周末野球 FC" />
      </view>
      <view class="form-field">
        <text class="form-label">球队介绍</text>
        <textarea v-model="createForm.description" class="form-textarea" placeholder="一句话说明球队风格、城市或活动时间" />
      </view>
      <view class="form-field">
        <text class="form-label">入队密码</text>
        <input v-model="createForm.joinPassword" class="form-input" placeholder="可选，留空则无需密码" password />
      </view>
      <view :class="['primary-button', canCreate ? '' : 'primary-button-disabled']" @tap="handleCreateTeam">
        {{ submitting ? "创建中..." : "创建球队" }}
      </view>
    </view>

    <view v-else-if="activeMode === 'join'" class="form-card">
      <text class="form-title">查找已有球队</text>
      <view class="search-row">
        <input v-model="searchKeyword" class="form-input search-input" placeholder="输入球队名称" confirm-type="search" @confirm="handleSearchTeams" />
        <view class="search-button" @tap="handleSearchTeams">{{ searching ? "搜索中" : "搜索" }}</view>
      </view>

      <view v-if="searchResults.length" class="team-result-list">
        <view
          v-for="team in searchResults"
          :key="team.id"
          :class="['team-result-card', selectedTeam?.id === team.id ? 'team-result-card-active' : '']"
          @tap="handleSelectTeam(team)"
        >
          <view>
            <text class="team-result-title">{{ team.name }}</text>
            <text class="team-result-meta">{{ team.member_count }} 人 · 信用 {{ team.credit_score }} · {{ team.trust_label }}</text>
          </view>
          <text class="team-result-action">{{ selectedTeam?.id === team.id ? "已选择" : "选择" }}</text>
        </view>
      </view>
      <view v-else class="empty-box">搜索后会展示可加入的球队。</view>

      <view v-if="selectedTeam" class="join-panel">
        <text class="form-label">加入 {{ selectedTeam.name }}</text>
        <input
          v-if="selectedTeamRequiresPassword"
          v-model="joinPassword"
          class="form-input"
          placeholder="请输入入队密码"
          password
        />
        <view v-else class="open-team-note">该球队无需入队密码。</view>
        <view :class="['primary-button', canJoin ? '' : 'primary-button-disabled']" @tap="handleJoinTeam">
          {{ submitting ? "加入中..." : "确认加入" }}
        </view>
      </view>
    </view>

    <view v-else class="form-card">
      <text class="form-title">队员管理</text>
      <view v-if="!currentTeam" class="empty-box">请先创建或加入球队。</view>
      <view v-else-if="!canManageMembers" class="empty-box">只有队长或领队可以管理队员。</view>
      <view v-else>
        <text class="form-label">添加队员</text>
        <view>
          <view class="search-row member-search-row">
            <input
              v-model="userSearchKeyword"
              class="form-input search-input"
              placeholder="输入昵称、姓名或用户名"
              confirm-type="search"
              @confirm="handleSearchUsers"
            />
            <view class="search-button" @tap="handleSearchUsers">{{ userSearching ? "搜索中" : "搜索" }}</view>
          </view>
          <view v-if="userSearchResults.length" class="candidate-list">
            <view
              v-for="candidate in userSearchResults"
              :key="candidate.id"
              :class="['candidate-card', selectedCandidate?.id === candidate.id ? 'candidate-card-active' : '']"
              @tap="handleCandidateTap(candidate)"
            >
              <image v-if="candidate.avatar_url" class="candidate-avatar" :src="candidate.avatar_url" mode="aspectFill" />
              <view v-else class="candidate-avatar candidate-avatar-fallback">{{ resolveUserDisplayName(candidate).slice(0, 1) }}</view>
              <view class="candidate-main">
                <text class="team-result-title">{{ resolveUserDisplayName(candidate) }}</text>
                <text class="team-result-meta">{{ candidate.username || "微信用户" }}</text>
              </view>
              <text :class="['team-result-action', isCurrentMember(candidate.id) && !isCaptainMember(candidate.id) ? 'team-result-action-danger' : '']">
                {{ candidateActionLabel(candidate) }}
              </text>
            </view>
          </view>
        </view>
        <wd-picker
          v-model="memberForm.role"
          title="选择角色"
          placeholder="请选择角色"
          :columns="memberRoleOptions"
          value-key="value"
          label-key="label"
          confirm-button-text="确定"
          cancel-button-text="取消"
          custom-class="member-role-picker"
          custom-cell-class="member-role-picker-cell"
          custom-value-class="member-role-picker-value"
        />

        <input v-model="memberForm.jerseyNumber" class="form-input" placeholder="球衣号，可选" />
        <view class="member-action-row">
          <view class="primary-button member-submit" @tap="handleAddMember">
            {{ submitting ? "提交中..." : "添加队员" }}
          </view>
        </view>

        <view class="team-result-list">
          <view v-for="member in currentMembers" :key="member.user_id" class="member-card">
            <view>
              <text class="team-result-title">{{ memberName(member.user_id) }}</text>
              <text class="team-result-meta">
                {{ roleLabel(member.role) }} · {{ member.jersey_number || "无号码" }} · {{ memberStatusLabel(member.status) }}
              </text>
            </view>
            <view class="member-actions">
              <view class="member-link" @tap.stop="handleEditMember(member)">编辑</view>
              <view class="member-link" @tap.stop="handleToggleMemberStatus(member)">{{ member.status === 1 ? "冻结" : "恢复" }}</view>
              <view v-if="member.role !== 'captain'" class="member-link member-link-danger" @tap.stop="handleRemoveMember(member)">移除</view>
            </view>
          </view>
        </view>
      </view>
    </view>

    <wd-popup
      v-model="editMemberPopupVisible"
      position="bottom"
      custom-class="member-edit-popup"
      :close-on-click-modal="!submitting"
      safe-area-inset-bottom
      root-portal
      @close="closeEditMemberPopup"
    >
      <view class="member-edit-sheet">
        <view class="member-edit-header">
          <view>
            <text class="member-edit-kicker">编辑队员</text>
            <text class="member-edit-title">{{ editingMember ? memberName(editingMember.user_id) : "队员" }}</text>
          </view>
          <view class="member-edit-close" @tap="closeEditMemberPopup">取消</view>
        </view>

        <wd-picker
          v-model="editMemberForm.role"
          title="选择角色"
          placeholder="请选择角色"
          :columns="memberRoleOptions"
          value-key="value"
          label-key="label"
          confirm-button-text="确定"
          cancel-button-text="取消"
          custom-class="member-role-picker"
          custom-cell-class="member-role-picker-cell"
          custom-value-class="member-role-picker-value"
        />

        <input v-model="editMemberForm.jerseyNumber" class="form-input member-edit-input" placeholder="球衣号，可选" />
        <view class="primary-button" @tap="handleUpdateMember">
          {{ submitting ? "保存中..." : "保存队员" }}
        </view>
      </view>
    </wd-popup>
  </view>
</template>

<style scoped>
.team-manage-page {
  min-height: 100vh;
  padding: 34rpx 28rpx 96rpx;
  background: linear-gradient(180deg, #fbfcf7 0%, #eef2e6 100%);
  box-sizing: border-box;
}

.team-manage-hero,
.form-card {
  border-radius: 32rpx;
  background: #ffffff;
  box-shadow: 0 18rpx 36rpx rgba(16, 17, 15, 0.06);
}

.team-manage-hero {
  padding: 34rpx 30rpx;
}

.team-manage-kicker,
.form-label,
.team-result-meta,
.team-manage-copy {
  color: #6a7165;
  font-size: 24rpx;
  font-weight: 700;
}

.team-manage-title,
.form-title {
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

.form-card {
  padding: 30rpx;
}

.form-title {
  margin-bottom: 24rpx;
  font-size: 34rpx;
}

.form-field {
  margin-top: 20rpx;
}

.form-label {
  display: block;
  margin-bottom: 10rpx;
}

.form-input,
.form-textarea {
  width: 100%;
  border-radius: 22rpx;
  background: #f3f5ef;
  color: #111310;
  font-size: 28rpx;
  font-weight: 700;
  box-sizing: border-box;
}

.form-input {
  height: 86rpx;
  padding: 0 22rpx;
}

.form-textarea {
  min-height: 150rpx;
  padding: 22rpx;
}

.primary-button,
.search-button {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 24rpx;
  background: #c8ff00;
  color: #10110f;
  font-size: 28rpx;
  font-weight: 900;
}

.primary-button {
  height: 88rpx;
  margin-top: 28rpx;
}

.primary-button-disabled {
  opacity: 0.45;
}

.search-row {
  display: flex;
  gap: 12rpx;
}

.search-input {
  flex: 1;
}

.search-button {
  width: 136rpx;
  height: 86rpx;
}

.team-logo-field {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 20rpx;
  border-radius: 24rpx;
  background: #f3f5ef;
}

.team-logo-preview {
  width: 104rpx;
  height: 104rpx;
  border-radius: 28rpx;
  flex-shrink: 0;
  overflow: hidden;
  background: #10110f;
}

.team-logo-image,
.team-logo-fallback {
  width: 100%;
  height: 100%;
}

.team-logo-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c8ff00;
  font-size: 38rpx;
  font-weight: 900;
}

.team-logo-main {
  flex: 1;
  min-width: 0;
}

.team-logo-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 190rpx;
  height: 66rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  background: #10110f;
  color: #c8ff00;
  font-size: 24rpx;
  font-weight: 900;
  box-sizing: border-box;
}

.team-logo-note {
  display: block;
  margin-top: 10rpx;
  color: #6a7165;
  font-size: 22rpx;
  font-weight: 700;
  line-height: 1.35;
}

.team-result-list {
  display: flex;
  flex-direction: column;
  gap: 14rpx;
  margin-top: 22rpx;
}

.team-result-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18rpx;
  padding: 22rpx;
  border-radius: 24rpx;
  background: #f5f7f1;
  border: 2rpx solid transparent;
}

.team-result-card-active {
  border-color: #c8ff00;
  background: #fbfff0;
}

.team-result-title {
  display: block;
  color: #111310;
  font-size: 30rpx;
  font-weight: 900;
}

.team-result-meta {
  display: block;
  margin-top: 6rpx;
}

.team-result-action {
  color: #111310;
  font-size: 24rpx;
  font-weight: 900;
}

.team-result-action-danger {
  color: #b42318;
}

.join-panel,
.empty-box,
.open-team-note {
  margin-top: 22rpx;
  padding: 22rpx;
  border-radius: 24rpx;
  background: #f3f5ef;
}

.empty-box,
.open-team-note {
  color: #6b7166;
  font-size: 26rpx;
  font-weight: 700;
}

.member-search-row {
  margin-top: 14rpx;
}

.candidate-list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-top: 14rpx;
}

.candidate-card {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 16rpx;
  border-radius: 22rpx;
  background: #ffffff;
  border: 2rpx solid transparent;
}

.candidate-card-active {
  border-color: #c8ff00;
  background: #fbfff0;
}

.candidate-avatar {
  width: 68rpx;
  height: 68rpx;
  border-radius: 20rpx;
  flex-shrink: 0;
  overflow: hidden;
}

.candidate-avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #111310;
  color: #c8ff00;
  font-size: 28rpx;
  font-weight: 900;
}

.candidate-main {
  flex: 1;
  min-width: 0;
}

.member-search-empty {
  margin-top: 14rpx;
}

.member-role-picker {
  width: 100%;
  display: block;
  margin-top: 14rpx;
}

:deep(.member-role-picker-cell) {
  width: 100%;
  height: 86rpx;
  padding: 0 22rpx;
  border-radius: 22rpx;
  background: #f3f5ef;
  color: #111310;
  box-sizing: border-box;
}

:deep(.member-role-picker-value) {
  color: #111310;
  font-size: 28rpx;
  font-weight: 900;
}

.member-action-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.secondary-button {
  width: 150rpx;
  height: 88rpx;
  margin-top: 28rpx;
  border-radius: 24rpx;
  background: #e3e7dd;
  color: #31352d;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  font-weight: 900;
}

.member-submit {
  flex: 1;
}

:deep(.member-edit-popup) {
  border-radius: 34rpx 34rpx 0 0;
  background: #ffffff;
}

.member-edit-sheet {
  padding: 34rpx 30rpx 38rpx;
  background: #ffffff;
  border-radius: 34rpx 34rpx 0 0;
}

.member-edit-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20rpx;
  margin-bottom: 22rpx;
}

.member-edit-kicker {
  display: block;
  color: #6a7165;
  font-size: 24rpx;
  font-weight: 800;
}

.member-edit-title {
  display: block;
  margin-top: 8rpx;
  color: #10110f;
  font-size: 38rpx;
  font-weight: 900;
}

.member-edit-close {
  height: 58rpx;
  padding: 0 22rpx;
  border-radius: 999rpx;
  background: #edf0e7;
  color: #5d6458;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
  font-weight: 900;
}

.member-edit-input {
  margin-top: 14rpx;
}

.member-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 22rpx;
  border-radius: 24rpx;
  background: #f5f7f1;
}

.member-actions {
  display: flex;
  gap: 12rpx;
  flex-shrink: 0;
}

.member-link {
  min-width: 54rpx;
  height: 52rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #111310;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 1;
}

.member-link-danger {
  color: #b42318;
}
</style>
