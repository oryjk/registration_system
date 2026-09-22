<script setup lang="ts">
import { useAccentTheme } from "@/stores/theme";
import { computed, ref, watch } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import AppButton from "@/components/ui/AppButton.vue";
import { bindMyPhoneNumber, updateMyProfile, uploadMyAvatar } from "@/api/user";
import { getPhoneNumber } from "@/api/wx";
import { loadMiniAppRuntimeConfig } from "@/config/runtimeConfig";
import { useTeamContext } from "@/stores/teamContext";
import { getCustomNavMetrics } from "@/utils/customNav";
import { needsProfileCompletion } from "@/utils/profileCompletion";

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
  <view class="app-theme-scope profile-setup-page" :style="[themePageStyle, pageStyle]">
    <AppTabHeader :title="headerTitle" showBack />
    <view class="profile-setup-content">
      <view class="profile-editor-form">
        <!-- #ifdef MP-WEIXIN -->
        <button class="profile-avatar-row" hover-class="profile-editor-button--pressed" open-type="chooseAvatar" :disabled="isSaving" @chooseavatar="handleChooseAvatar" aria-label="更换头像">
          <view class="profile-avatar-copy"><text class="profile-editor-label">头像</text><text class="profile-avatar-hint">点击更换头像</text></view>
          <view class="profile-editor-avatar">
            <image v-if="avatarPreview && !avatarLoadFailed" class="profile-editor-avatar__image" :src="avatarPreview" mode="aspectFill" @error="avatarLoadFailed = true" />
            <wd-icon v-else name="user" size="42rpx" color="var(--ui-color-text-muted)" />
          </view>
          <wd-icon name="arrow-right" size="28rpx" color="var(--ui-color-text-muted)" />
        </button>
        <!-- #endif -->
        <!-- #ifndef MP-WEIXIN -->
        <button class="profile-avatar-row" hover-class="profile-editor-button--pressed" :disabled="isSaving" @tap="handlePickAvatarFallback" aria-label="更换头像">
          <view class="profile-avatar-copy"><text class="profile-editor-label">头像</text><text class="profile-avatar-hint">点击更换头像</text></view>
          <view class="profile-editor-avatar">
            <image v-if="avatarPreview && !avatarLoadFailed" class="profile-editor-avatar__image" :src="avatarPreview" mode="aspectFill" @error="avatarLoadFailed = true" />
            <wd-icon v-else name="user" size="42rpx" color="var(--ui-color-text-muted)" />
          </view>
          <wd-icon name="arrow-right" size="28rpx" color="var(--ui-color-text-muted)" />
        </button>
        <!-- #endif -->
        <view class="profile-editor-field">
          <text class="profile-editor-label">昵称</text>
          <input v-model="nicknameInput" class="profile-editor-input" type="nickname" maxlength="24" placeholder="请输入你的昵称" placeholder-class="profile-setup-input-placeholder" @input="hasUnsavedEdits = true" />
        </view>
        <view v-if="shouldShowPhoneBinding" class="profile-editor-field">
          <text class="profile-editor-label">手机号</text>
          <view class="profile-phone-row">
            <input v-model="phoneInput" class="profile-editor-input profile-phone-input" type="number" maxlength="20" placeholder="可选，方便队长联系" placeholder-class="profile-setup-input-placeholder" @input="hasUnsavedEdits = true" />
            <!-- #ifdef MP-WEIXIN -->
            <button class="profile-phone-button" hover-class="profile-editor-button--pressed" open-type="getPhoneNumber" @getphonenumber="handleGetPhoneNumber">{{ isBindingPhone ? "绑定中" : "一键绑定" }}</button>
            <!-- #endif -->
          </view>
        </view>
      </view>
      <text class="profile-editor-note">{{ isEditMode ? '头像和昵称会同步到报名记录与球队名单。' : '完善头像和昵称，方便队友认出你。' }}</text>
      <view class="profile-editor-actions"><AppButton icon="check" block :disabled="!canSubmit" :loading="isSaving" @click="handleSubmit">{{ submitText }}</AppButton></view>
    </view>
  </view>
</template>
<style scoped>
.profile-setup-page {
  min-height: 100vh;
  padding: 0 28rpx calc(60rpx + env(safe-area-inset-bottom));
  background: var(--ui-color-page);
  box-sizing: border-box;
}
.profile-setup-content { width: 100%; max-width: 750rpx; margin: 0 auto; }
.profile-editor-form { overflow: hidden; border: var(--ui-border-default); border-radius: var(--ui-radius-card); background: var(--ui-color-surface); }
.profile-avatar-row { display: flex; align-items: center; gap: 16rpx; width: 100%; margin: 0; padding: 24rpx; border: 0; border-radius: 0; background: transparent; text-align: left; line-height: 1.5; }
.profile-avatar-row::after,.profile-phone-button::after { border: 0; }
.profile-avatar-copy { flex: 1; min-width: 0; }
.profile-avatar-hint { display: block; margin-top: 8rpx; font-size: 22rpx; color: var(--ui-color-text-muted); }
.profile-editor-avatar { display: flex; align-items: center; justify-content: center; flex-shrink: 0; width: 96rpx; height: 96rpx; overflow: hidden; border-radius: 50%; background: var(--ui-color-neutral-bg); }
.profile-editor-avatar__image { width: 100%; height: 100%; }
.profile-editor-field { margin: 0 24rpx; padding: 24rpx 0; border-top: var(--ui-border-default); }
.profile-editor-label { display: block; font-size: 26rpx; font-weight: 600; color: var(--ui-color-text); }
.profile-editor-input { width: 100%; height: 80rpx; margin-top: 14rpx; padding: 0 20rpx; border: var(--ui-border-default); border-radius: 16rpx; background: var(--ui-color-surface); color: var(--ui-color-text); font-size: 28rpx; box-sizing: border-box; }
.profile-phone-row { display: flex; align-items: center; gap: 12rpx; }
.profile-phone-input { flex: 1; min-width: 0; }
.profile-phone-button { flex-shrink: 0; margin: 14rpx 0 0; padding: 0 18rpx; height: 80rpx; line-height: 80rpx; border: 0; border-radius: 16rpx; background: var(--ui-color-accent-soft); color: var(--ui-color-accent-deep); font-size: 24rpx; }
.profile-setup-input-placeholder { color: var(--ui-color-text-muted); }
.profile-editor-note { display: block; padding: 18rpx 8rpx 0; color: var(--ui-color-text-muted); font-size: 22rpx; line-height: 1.5; }
.profile-editor-actions { margin-top: 28rpx; }
.profile-editor-button--pressed { opacity: .75; }
/* #ifdef H5 */
.profile-setup-page { width: 100%; max-width: 750rpx; margin: 0 auto; }
.profile-setup-page :deep(.app-tab-header-shell) { left: 50%; right: auto; width: 100%; max-width: 750rpx; transform: translateX(-50%); }
/* #endif */
</style>
