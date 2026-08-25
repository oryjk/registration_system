<script setup lang="ts">
import { useAccentTheme } from "@/stores/theme";
import { computed, ref, watch } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import NeoButton from "@/components/neo/NeoButton.vue";
import NeoSectionHeader from "@/components/neo/NeoSectionHeader.vue";
import NeoSurface from "@/components/neo/NeoSurface.vue";
import { bindMyPhoneNumber, updateMyProfile, uploadMyAvatar } from "@/api/user";
import { getPhoneNumber } from "@/api/wx";
import { loadMiniAppRuntimeConfig } from "@/config/runtimeConfig";
import { useTeamContext } from "@/stores/teamContext";
import { getCustomNavMetrics } from "@/utils/customNav";
import { needsProfileCompletion } from "@/utils/profileCompletion";
import defaultAvatarUrl from "@/static/tab-png/user-active.png";

const { themePageStyle } = useAccentTheme();

interface ChooseAvatarEvent {
  detail?: {
    avatarUrl?: string;
  };
}

const { currentUser, ensureSessionReady, refreshSessionContext } = useTeamContext();
const navMetrics = getCustomNavMetrics();

const nicknameInput = ref("");
const phoneInput = ref("");
const avatarPreview = ref("");
const avatarLocalPath = ref("");
const isSaving = ref(false);
const isBindingPhone = ref(false);
const shouldShowPhoneBinding = ref(false);
const pageMode = ref<"setup" | "edit">("setup");
const avatarLoadFailed = ref(false);
// 用户已本地修改表单（如选了头像）后，onShow 回来不再用服务端数据覆盖，
// 否则从微信相册返回时 hydrate 会晚于 chooseavatar 回调执行、把临时头像清掉。
const hasUnsavedEdits = ref(false);

const isEditMode = computed(() => pageMode.value === "edit");
const canSubmit = computed(() => (
  !!nicknameInput.value.trim() && (isEditMode.value || !!avatarPreview.value)
));
const headerTitle = computed(() => (isEditMode.value ? "编辑资料" : "完善资料"));
const heroTitle = computed(() => (isEditMode.value ? "编辑头像和昵称" : "完善头像和昵称"));
const heroCopy = computed(() =>
  isEditMode.value
    ? "更新头像和昵称后会同步到个人中心、报名记录和球队成员信息中。"
    : "选择头像并填写昵称，方便队友在报名记录和球队成员中认出你。",
);
const submitText = computed(() => {
  if (isSaving.value) return "保存中...";
  return "保存资料";
});
const pageStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));

function goBackToApp() {
  const pages = getCurrentPages();
  if (pages.length > 1) {
    uni.navigateBack();
    return;
  }

  uni.switchTab({
    url: "/pages/home/index",
  });
}

function hydrateFormFromCurrentUser() {
  const user = currentUser.value;
  if (!user) return;

  nicknameInput.value = user.nickname?.trim() || user.real_name?.trim() || user.username?.trim() || "";
  phoneInput.value = user.phone_number?.trim() || "";
  avatarPreview.value = user.avatar_url?.trim() || "";
  avatarLocalPath.value = "";
  avatarLoadFailed.value = false;
}

async function hydrateRuntimeConfig() {
  const config = await loadMiniAppRuntimeConfig();
  shouldShowPhoneBinding.value = config.profile.require_phone_binding;
}

function handleChooseAvatar(event: ChooseAvatarEvent) {
  const avatarUrl = event.detail?.avatarUrl?.trim() || "";
  if (!avatarUrl) return;
  avatarLocalPath.value = avatarUrl;
  avatarPreview.value = avatarUrl;
  avatarLoadFailed.value = false;
  hasUnsavedEdits.value = true;
}

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
  avatarLoadFailed.value = false;
  hasUnsavedEdits.value = true;
}

watch(avatarPreview, () => {
  avatarLoadFailed.value = false;
});

async function handleSubmit() {
  if (!canSubmit.value || isSaving.value) {
    return;
  }

  const nickname = nicknameInput.value.trim();
  if (!nickname) {
    uni.showToast({
      title: "请输入昵称",
      icon: "none",
    });
    return;
  }

  isSaving.value = true;
  try {
    let avatarUrl = avatarPreview.value;

    if (avatarLocalPath.value) {
      uni.showLoading({
        title: "上传头像中...",
        mask: true,
      });
      avatarUrl = (await uploadMyAvatar(avatarLocalPath.value)).avatar_url;
    }

    uni.showLoading({
      title: "保存资料中...",
      mask: true,
    });
    await updateMyProfile({
      nickname,
      avatar_url: avatarUrl,
    });
    if (shouldShowPhoneBinding.value && phoneInput.value.trim()) {
      await bindMyPhoneNumber({
        phone_number: phoneInput.value.trim(),
      });
    }
    await refreshSessionContext();
    hasUnsavedEdits.value = false;
    uni.hideLoading();
    uni.showToast({
      title: isEditMode.value ? "资料已保存" : "资料已完善",
      icon: "none",
    });
    goBackToApp();
  } catch (error) {
    uni.hideLoading();
    uni.showToast({
      title: error instanceof Error ? error.message : "保存资料失败",
      icon: "none",
    });
  } finally {
    isSaving.value = false;
  }
}

async function handleGetPhoneNumber(event: Event) {
  if (!shouldShowPhoneBinding.value) {
    return;
  }

  const detail = event as Event & { detail?: { code?: string; errMsg?: string } };
  const code = detail.detail?.code?.trim() || "";
  if (!code) {
    uni.showToast({
      title: "未授权手机号",
      icon: "none",
    });
    return;
  }

  isBindingPhone.value = true;
  try {
    const result = await getPhoneNumber(code);
    phoneInput.value = result.phone_number;
    await bindMyPhoneNumber({
      phone_number: result.phone_number,
    });
    await refreshSessionContext();
    uni.showToast({
      title: "手机号已绑定",
      icon: "none",
    });
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : "手机号绑定失败",
      icon: "none",
    });
  } finally {
    isBindingPhone.value = false;
  }
}

onLoad((options) => {
  pageMode.value = options?.mode === "edit" ? "edit" : "setup";
});

onShow(async () => {
  try {
    await Promise.all([ensureSessionReady(), hydrateRuntimeConfig()]);
    if (!hasUnsavedEdits.value) {
      hydrateFormFromCurrentUser();
    }

    if (!isEditMode.value && !needsProfileCompletion(currentUser.value)) {
      goBackToApp();
    }
  } catch (error) {
    shouldShowPhoneBinding.value = false;
    uni.showToast({
      title: error instanceof Error ? error.message : "加载资料失败",
      icon: "none",
    });
  }
});
</script>

<template>
  <page-meta :page-style="themePageStyle" />
  <view class="profile-setup-page" :style="pageStyle">
    <AppTabHeader :title="headerTitle" showBack />

    <view class="profile-setup-content">
      <NeoSurface variant="dark" custom-class="profile-editor-hero">
        <view class="profile-editor-hero__main">
          <view class="profile-editor-hero__copy">
            <text class="profile-editor-hero__title">{{ heroTitle }}</text>
            <text class="profile-editor-hero__description">{{ heroCopy }}</text>
          </view>
          <view class="profile-editor-avatar">
            <image
              v-if="avatarPreview && !avatarLoadFailed"
              class="profile-editor-avatar__image"
              :src="avatarPreview"
              mode="aspectFill"
              @error="avatarLoadFailed = true"
            />
            <image v-else class="profile-editor-avatar__fallback" :src="defaultAvatarUrl" mode="aspectFit" />
          </view>
        </view>

        <!-- #ifdef MP-WEIXIN -->
        <button
          class="profile-editor-avatar-button"
          hover-class="profile-editor-button--pressed"
          open-type="chooseAvatar"
          @chooseavatar="handleChooseAvatar"
        >
          更换头像
        </button>
        <!-- #endif -->

        <!-- #ifndef MP-WEIXIN -->
        <NeoButton variant="lime" block @click="handlePickAvatarFallback">更换头像</NeoButton>
        <!-- #endif -->
      </NeoSurface>

      <NeoSurface custom-class="profile-editor-form">
        <NeoSectionHeader title="基础资料" marker="01" caption="这些信息会同步到报名记录和球队成员信息中" />

        <view class="profile-editor-field">
          <text class="profile-editor-label">昵称</text>
          <input
            v-model="nicknameInput"
            class="profile-editor-input"
            type="nickname"
            maxlength="24"
            placeholder="请输入你的昵称"
            placeholder-class="profile-setup-input-placeholder"
            @input="hasUnsavedEdits = true"
          />
        </view>

        <view v-if="shouldShowPhoneBinding" class="profile-editor-field">
          <text class="profile-editor-label">手机号</text>
          <view class="profile-phone-row">
            <input
              v-model="phoneInput"
              class="profile-editor-input profile-phone-input"
              type="number"
              maxlength="20"
              placeholder="可选，绑定后方便队长联系"
              placeholder-class="profile-setup-input-placeholder"
              @input="hasUnsavedEdits = true"
            />
            <!-- #ifdef MP-WEIXIN -->
            <button
              class="profile-phone-button"
              hover-class="profile-editor-button--pressed"
              open-type="getPhoneNumber"
              @getphonenumber="handleGetPhoneNumber"
            >
              {{ isBindingPhone ? "绑定中" : "一键绑定" }}
            </button>
            <!-- #endif -->
          </view>
        </view>

        <view class="profile-editor-actions">
          <NeoButton
            block
            :disabled="!canSubmit"
            :loading="isSaving"
            @click="handleSubmit"
          >
            {{ submitText }}
          </NeoButton>
        </view>
      </NeoSurface>
    </view>
  </view>
</template>

<style scoped>
.profile-setup-page {
  min-height: 100vh;
  padding: 0 28rpx 100rpx;
  background: var(--neo-color-page);
  box-sizing: border-box;
}

.profile-setup-content {
  width: 100%;
  max-width: 900rpx;
  margin: 0 auto;
  box-sizing: border-box;
}

.profile-editor-hero {
  margin-top: 22rpx;
  padding: 24rpx;
  border: var(--neo-border-strong);
  border-radius: var(--neo-radius-md);
  box-shadow: 8rpx 8rpx 0 var(--neo-color-accent);
}

.profile-editor-hero__main {
  display: flex;
  align-items: center;
  gap: 20rpx;
}

.profile-editor-hero__copy {
  min-width: 0;
  flex: 1;
}

.profile-editor-hero__title {
  display: block;
  color: var(--neo-color-text-inverse);
  font-size: 38rpx;
  font-weight: 900;
  line-height: 1.2;
  word-break: break-word;
}

.profile-editor-hero__description {
  display: block;
  margin-top: 12rpx;
  color: rgba(255, 255, 255, 0.74);
  font-size: 23rpx;
  font-weight: 700;
  line-height: 1.6;
  word-break: break-word;
}

.profile-editor-avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 132rpx;
  height: 132rpx;
  overflow: hidden;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-accent);
  box-sizing: border-box;
}

.profile-editor-avatar__image {
  width: 100%;
  height: 100%;
}

.profile-editor-avatar__fallback {
  width: 74rpx;
  height: 74rpx;
}

.profile-editor-avatar-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: var(--neo-button-height-md);
  margin-top: 20rpx;
  padding: 0 26rpx;
  border: var(--neo-button-border);
  border-radius: var(--neo-button-radius);
  background: var(--neo-color-accent);
  color: var(--neo-color-text);
  font-size: var(--neo-button-font-size-md);
  font-weight: 900;
  line-height: var(--neo-button-height-md);
  box-sizing: border-box;
}

.profile-editor-button--pressed {
  transform: translate(2rpx, 2rpx);
  box-shadow: none;
}

.profile-editor-form {
  margin-top: 24rpx;
  margin-bottom: 28rpx;
  padding: 6rpx 24rpx 24rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
  box-shadow: 8rpx 8rpx 0 var(--neo-color-text);
}

.profile-phone-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.profile-editor-field {
  margin-top: 26rpx;
}

.profile-editor-label {
  display: block;
  color: var(--neo-color-text);
  font-size: 24rpx;
  font-weight: 900;
  line-height: 1.3;
}

.profile-editor-input {
  display: block;
  width: 100%;
  min-height: 84rpx;
  margin-top: 10rpx;
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

.profile-phone-input {
  flex: 1;
  min-width: 0;
}

.profile-phone-button {
  flex-shrink: 0;
  width: 168rpx;
  height: 84rpx;
  padding: 0;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-sm);
  background: var(--neo-color-text);
  color: var(--neo-color-accent);
  font-size: 22rpx;
  font-weight: 900;
  line-height: 84rpx;
  box-sizing: border-box;
}

.profile-setup-input-placeholder {
  color: var(--neo-color-text-muted);
}

.profile-editor-actions {
  margin-top: 28rpx;
}

@media (max-width: 560rpx) {
  .profile-editor-hero__main {
    align-items: flex-start;
  }

  .profile-editor-avatar {
    width: 112rpx;
    height: 112rpx;
  }

  .profile-editor-avatar__fallback {
    width: 66rpx;
    height: 66rpx;
  }
}
</style>
