<script setup lang="ts">
import { computed, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import AppTabHeader from "@/components/AppTabHeader.vue";
import { bindMyPhoneNumber, updateMyProfile, uploadMyAvatar } from "@/api/user";
import { getPhoneNumber } from "@/api/wx";
import { useTeamContext } from "@/stores/teamContext";
import { getCustomNavMetrics } from "@/utils/customNav";
import { needsProfileCompletion } from "@/utils/profileCompletion";

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
const pageMode = ref<"setup" | "edit">("setup");

const canSubmit = computed(() => !!nicknameInput.value.trim() && !!avatarPreview.value);
const isEditMode = computed(() => pageMode.value === "edit");
const headerTitle = computed(() => (isEditMode.value ? "编辑资料" : "完善资料"));
const heroTag = computed(() => (isEditMode.value ? "个人资料" : "首次登录"));
const heroTitle = computed(() => (isEditMode.value ? "编辑头像和昵称" : "先完善资料"));
const heroCopy = computed(() =>
  isEditMode.value
    ? "更新头像和昵称后会同步到个人中心、报名记录和球队成员信息中。"
    : "选择头像并填写昵称。资料会保存到后端，后续登录不会再重复出现这一步。",
);
const submitText = computed(() => {
  if (isSaving.value) return "保存中...";
  return isEditMode.value ? "保存资料" : "保存并进入";
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
}

function handleChooseAvatar(event: ChooseAvatarEvent) {
  const avatarUrl = event.detail?.avatarUrl?.trim() || "";
  if (!avatarUrl) return;
  avatarLocalPath.value = avatarUrl;
  avatarPreview.value = avatarUrl;
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
}

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
    if (phoneInput.value.trim()) {
      await bindMyPhoneNumber({
        phone_number: phoneInput.value.trim(),
      });
    }
    await refreshSessionContext();
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
    await ensureSessionReady();
    hydrateFormFromCurrentUser();

    if (!isEditMode.value && !needsProfileCompletion(currentUser.value)) {
      goBackToApp();
    }
  } catch (error) {
    uni.showToast({
      title: error instanceof Error ? error.message : "加载资料失败",
      icon: "none",
    });
  }
});
</script>

<template>
  <view class="profile-setup-page" :style="pageStyle">
    <AppTabHeader :title="headerTitle" showBack />

    <view class="profile-setup-hero">
      <text class="profile-setup-tag">{{ heroTag }}</text>
      <text class="profile-setup-title">{{ heroTitle }}</text>
      <text class="profile-setup-copy">{{ heroCopy }}</text>
    </view>

    <view class="profile-setup-card">
      <view class="profile-setup-avatar-block">
        <view class="profile-setup-avatar-shell">
          <image v-if="avatarPreview" class="profile-setup-avatar-image" :src="avatarPreview" mode="aspectFill" />
          <text v-else class="profile-setup-avatar-fallback">头像</text>
        </view>

        <!-- #ifdef MP-WEIXIN -->
        <button class="profile-setup-avatar-button" open-type="chooseAvatar" @chooseavatar="handleChooseAvatar">
          选择微信头像
        </button>
        <!-- #endif -->

        <!-- #ifndef MP-WEIXIN -->
        <view class="profile-setup-avatar-button" @tap="handlePickAvatarFallback">
          选择头像
        </view>
        <!-- #endif -->
      </view>

      <view class="profile-setup-form">
        <text class="profile-setup-label">昵称</text>
        <input
          v-model="nicknameInput"
          class="profile-setup-input"
          type="nickname"
          maxlength="24"
          placeholder="请输入你的昵称"
          placeholder-class="profile-setup-input-placeholder"
        />
      </view>

      <view class="profile-setup-form">
        <text class="profile-setup-label">手机号</text>
        <view class="profile-phone-row">
          <input
            v-model="phoneInput"
            class="profile-setup-input profile-phone-input"
            type="number"
            maxlength="20"
            placeholder="可选，绑定后方便队长联系"
            placeholder-class="profile-setup-input-placeholder"
          />
          <!-- #ifdef MP-WEIXIN -->
          <button class="profile-phone-button" open-type="getPhoneNumber" @getphonenumber="handleGetPhoneNumber">
            {{ isBindingPhone ? "绑定中" : "微信绑定" }}
          </button>
          <!-- #endif -->
        </view>
      </view>

      <view :class="['profile-setup-submit', !canSubmit ? 'profile-setup-submit-disabled' : '']" @tap="handleSubmit">
        {{ submitText }}
      </view>
    </view>
  </view>
</template>

<style scoped>
.profile-setup-page {
  min-height: 100vh;
  padding: 44rpx 28rpx 100rpx;
  background:
    radial-gradient(circle at top right, rgba(200, 255, 0, 0.18), transparent 24%),
    linear-gradient(180deg, #fcfdf8 0%, #f2f4ed 100%);
  box-sizing: border-box;
}

.profile-setup-hero,
.profile-setup-card {
  background: #ffffff;
  box-shadow: 0 20rpx 38rpx rgba(17, 17, 17, 0.05);
}

.profile-setup-hero {
  padding: 28rpx;
  border-radius: 34rpx;
}

.profile-setup-tag {
  display: inline-flex;
  padding: 8rpx 14rpx;
  border-radius: 999rpx;
  background: #eef8d6;
  color: #526a00;
  font-size: 22rpx;
  font-weight: 900;
}

.profile-setup-title {
  display: block;
  margin-top: 16rpx;
  font-size: 48rpx;
  color: #131410;
  font-weight: 900;
}

.profile-setup-copy {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  line-height: 1.6;
  color: #6b7068;
}

.profile-setup-card {
  margin-top: 20rpx;
  padding: 28rpx;
  border-radius: 34rpx;
}

.profile-setup-avatar-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20rpx;
}

.profile-setup-avatar-shell {
  width: 200rpx;
  height: 200rpx;
  border-radius: 56rpx;
  overflow: hidden;
  background: #eef2e6;
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile-setup-avatar-image {
  width: 100%;
  height: 100%;
}

.profile-setup-avatar-fallback {
  font-size: 34rpx;
  color: #70756c;
  font-weight: 700;
}

.profile-phone-row {
  display: flex;
  align-items: center;
  gap: 14rpx;
}

.profile-phone-input {
  flex: 1;
}

.profile-phone-button {
  width: 176rpx;
  height: 84rpx;
  padding: 0;
  border-radius: 22rpx;
  background: #151613;
  color: #c8ff00;
  font-size: 24rpx;
  font-weight: 900;
  line-height: 84rpx;
}

.profile-setup-avatar-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 82rpx;
  border-radius: 999rpx;
  background: #c8ff00;
  color: #131410;
  font-size: 28rpx;
  font-weight: 900;
}

.profile-setup-form {
  margin-top: 30rpx;
}

.profile-setup-label {
  display: block;
  font-size: 24rpx;
  color: #71766f;
  font-weight: 700;
}

.profile-setup-input {
  margin-top: 14rpx;
  width: 100%;
  min-height: 92rpx;
  padding: 0 28rpx;
  border-radius: 24rpx;
  background: #f3f5ef;
  color: #111827;
  font-size: 28rpx;
  box-sizing: border-box;
}

.profile-setup-input-placeholder {
  color: #9aa095;
}

.profile-setup-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 88rpx;
  margin-top: 28rpx;
  border-radius: 999rpx;
  background: #111827;
  color: #ffffff;
  font-size: 30rpx;
  font-weight: 900;
}

.profile-setup-submit-disabled {
  background: #daddd4;
  color: #7b8078;
}
</style>
