<script setup lang="ts">
import { computed, ref, watch } from "vue";
import NeoButton from "@/components/neo/NeoButton.vue";
import NeoConfirmDialog from "@/components/neo/NeoConfirmDialog.vue";
import { updateMyProfile, uploadMyAvatar } from "@/api/user";
import { useTeamContext } from "@/stores/teamContext";
import defaultAvatarUrl from "@/static/tab-png/user-active.png";

interface ChooseAvatarEvent {
  detail?: {
    avatarUrl?: string;
  };
}

const props = defineProps<{
  visible: boolean;
  /** 主按钮文案；不传则保留「保存并加入」兼容既有加入/邀请流程。 */
  primaryText?: string;
}>();

const emit = defineEmits<{
  /** 头像和昵称已保存，可以继续加入球队。 */
  (event: "completed"): void;
  /** 用户放弃设置（暂不 / 关闭），加入流程中止。 */
  (event: "cancel"): void;
}>();

const { currentUser, refreshSessionContext } = useTeamContext();

const nicknameInput = ref("");
const avatarPreview = ref("");
const avatarLocalPath = ref("");
const avatarLoadFailed = ref(false);
const saving = ref(false);

const canSubmit = computed(() => !!nicknameInput.value.trim() && !!avatarPreview.value && !saving.value);

function hydrateForm() {
  const user = currentUser.value;
  nicknameInput.value = user?.nickname?.trim() || user?.real_name?.trim() || "";
  avatarPreview.value = user?.avatar_url?.trim() || "";
  avatarLocalPath.value = "";
  avatarLoadFailed.value = false;
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) hydrateForm();
  },
);

watch(avatarPreview, () => {
  avatarLoadFailed.value = false;
});

function handleChooseAvatar(event: ChooseAvatarEvent) {
  const avatarUrl = event.detail?.avatarUrl?.trim() || "";
  if (!avatarUrl) return;
  avatarLocalPath.value = avatarUrl;
  avatarPreview.value = avatarUrl;
}

// H5 端没有 chooseAvatar 开放能力，退化为相册/拍照选图（与资料完善页一致）。
async function handlePickAvatarFallback() {
  const result = await uni.chooseImage({
    count: 1,
    sizeType: ["compressed"],
    sourceType: ["album", "camera"],
  });
  const avatarUrl = result.tempFilePaths?.[0] || "";
  if (!avatarUrl) return;
  avatarLocalPath.value = avatarUrl;
  avatarPreview.value = avatarUrl;
}

async function handleSave() {
  if (!canSubmit.value) return;
  const nickname = nicknameInput.value.trim();
  if (!nickname) {
    uni.showToast({ title: "请输入昵称", icon: "none" });
    return;
  }

  saving.value = true;
  try {
    let avatarUrl = avatarPreview.value;
    if (avatarLocalPath.value) {
      avatarUrl = (await uploadMyAvatar(avatarLocalPath.value)).avatar_url;
    }
    await updateMyProfile({ nickname, avatar_url: avatarUrl });
    await refreshSessionContext();
    uni.showToast({ title: "资料已设置", icon: "none" });
    emit("completed");
  } catch (error) {
    uni.showToast({ title: error instanceof Error ? error.message : "保存资料失败", icon: "none" });
  } finally {
    saving.value = false;
  }
}

function handleCancel() {
  if (saving.value) return;
  emit("cancel");
}
</script>

<template>
  <NeoConfirmDialog
    :visible="visible"
    title="先完善个人资料"
    message="设置头像和昵称后再加入球队，队友和队长才能在报名记录里认出你。"
    :primary-text="primaryText ?? '保存并加入'"
    secondary-text="暂不"
    :loading="saving"
    :primary-disabled="!canSubmit"
    @primary="handleSave"
    @secondary="handleCancel"
    @close="handleCancel"
  >
    <view class="profile-gate-form">
      <view class="profile-gate-avatar-row">
        <view class="profile-gate-avatar">
          <image
            v-if="avatarPreview && !avatarLoadFailed"
            class="profile-gate-avatar__image"
            :src="avatarPreview"
            mode="aspectFill"
            @error="avatarLoadFailed = true"
          />
          <image v-else class="profile-gate-avatar__fallback" :src="defaultAvatarUrl" mode="aspectFit" />
        </view>
        <!-- #ifdef MP-WEIXIN -->
        <button
          class="profile-gate-avatar-button"
          hover-class="profile-gate-avatar-button--pressed"
          open-type="chooseAvatar"
          @chooseavatar="handleChooseAvatar"
        >
          选择头像
        </button>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <NeoButton variant="outline" size="sm" @click="handlePickAvatarFallback">选择头像</NeoButton>
        <!-- #endif -->
      </view>
      <input
        v-model="nicknameInput"
        class="profile-gate-input"
        type="nickname"
        maxlength="24"
        placeholder="请输入你的昵称"
        placeholder-class="profile-gate-input-placeholder"
      />
    </view>
  </NeoConfirmDialog>
</template>

<style scoped>
.profile-gate-form {
  margin-top: 24rpx;
}

.profile-gate-avatar-row {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.profile-gate-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 112rpx;
  height: 112rpx;
  overflow: hidden;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-accent);
  box-sizing: border-box;
}

.profile-gate-avatar__image {
  width: 100%;
  height: 100%;
}

.profile-gate-avatar__fallback {
  width: 60rpx;
  height: 60rpx;
}

.profile-gate-avatar-button {
  display: flex;
  align-items: center;
  justify-content: center;
  height: var(--neo-button-height-sm, 72rpx);
  padding: 0 26rpx;
  border: var(--neo-button-border);
  border-radius: var(--neo-button-radius);
  background: var(--neo-color-accent);
  color: var(--neo-color-text);
  font-size: 24rpx;
  font-weight: 900;
  box-sizing: border-box;
}

.profile-gate-avatar-button--pressed {
  transform: translate(2rpx, 2rpx);
  box-shadow: none;
}

.profile-gate-input {
  display: block;
  width: 100%;
  min-height: 84rpx;
  margin-top: 22rpx;
  padding: 0 20rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-muted);
  color: var(--neo-color-text);
  font-size: 28rpx;
  font-weight: 800;
  line-height: 84rpx;
  box-sizing: border-box;
}

.profile-gate-input-placeholder {
  color: var(--neo-color-text-muted);
}
</style>
