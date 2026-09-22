<script setup lang="ts">
import { useAccentTheme } from "@/stores/theme";
import { computed } from "vue";
import AppTabHeader from "@/components/AppTabHeader.vue";
import AppButton from "@/components/ui/AppButton.vue";
import ConfirmDialog from "@/components/ui/ConfirmDialog.vue";
import SectionHeader from "@/components/ui/SectionHeader.vue";
import AppSurface from "@/components/ui/AppSurface.vue";
import { useMiniReviewStatus } from "@/stores/miniReview";
import { DEVELOPER_WECHAT_QRCODE_URL, OFFICIAL_ACCOUNT_QRCODE_URL } from "@/utils/developerContact";
import { getCustomNavMetrics } from "@/utils/customNav";
import { useTipDonation } from "./useTipDonation";

const { themePageStyle } = useAccentTheme();

const navMetrics = getCustomNavMetrics();
const pageStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));

// 审核模式下隐藏打赏入口（小程序审核对打赏类目敏感），仅保留二维码联系区。
const { shouldHideCreationEntrances } = useMiniReviewStatus();
const { amountInput, suggestionInput, isSubmitting, isLoggedIn, suggestionMaxLength, submitTipDonation, dialog } =
  useTipDonation();
</script>

<template>
  <page-meta :page-style="themePageStyle" />
  <view class="app-theme-scope contact-developer-page" :style="[themePageStyle, pageStyle]">
    <AppTabHeader title="联系开发者" showBack />

    <view class="contact-developer-content">
      <AppSurface custom-class="contact-developer-card">
        <SectionHeader title="微信与公众号" caption="长按二维码识别" />
        <view class="contact-developer-qrcodes">
          <view class="contact-developer-qrcode-item">
            <image
              class="contact-developer-qrcode"
              :src="DEVELOPER_WECHAT_QRCODE_URL"
              mode="widthFix"
              :show-menu-by-longpress="true"
            />
            <text class="contact-developer-qrcode-caption">加开发者微信</text>
          </view>
          <view class="contact-developer-qrcode-item">
            <image
              class="contact-developer-qrcode"
              :src="OFFICIAL_ACCOUNT_QRCODE_URL"
              mode="widthFix"
              :show-menu-by-longpress="true"
            />
            <text class="contact-developer-qrcode-caption">关注公众号</text>
          </view>
        </view>
      </AppSurface>

      <AppSurface v-if="!shouldHideCreationEntrances" custom-class="contact-developer-card">
        <SectionHeader title="请开发者喝咖啡" caption="可选金额 · 可留功能建议" />
        <text class="contact-developer-thanks">
          如果这个小程序帮到了你，可以请开发者喝杯咖啡。你的支持是我持续迭代的动力，也欢迎顺手写下你希望拥有的功能。
        </text>

        <view class="contact-developer-field">
          <text class="contact-developer-field__label">打赏金额（元）</text>
          <input
            v-model="amountInput"
            class="contact-developer-field__input"
            type="digit"
            :placeholder="'我干了，你随意'"
            placeholder-class="contact-developer-field__placeholder"
          />
        </view>

        <view class="contact-developer-field">
          <text class="contact-developer-field__label">功能建议（可选，支付成功后提交）</text>
          <textarea
            v-model="suggestionInput"
            class="contact-developer-field__textarea"
            :maxlength="suggestionMaxLength"
            placeholder="希望小程序有什么功能？可不填"
            placeholder-class="contact-developer-field__placeholder"
          />
        </view>

        <AppButton
          variant="lime"
          block
          :loading="isSubmitting"
          :disabled="isSubmitting"
          @click="submitTipDonation"
        >
          {{ isSubmitting ? "正在拉起支付..." : isLoggedIn ? "请喝咖啡" : "登录后请喝咖啡" }}
        </AppButton>
      </AppSurface>
    </view>

    <ConfirmDialog
      :visible="dialog.confirmDialogVisible.value"
      :title="dialog.confirmDialogState.title"
      :message="dialog.confirmDialogState.message"
      :highlight="dialog.confirmDialogState.highlight"
      :link-text="dialog.confirmDialogState.linkText"
      :primary-text="dialog.confirmDialogState.primaryText"
      :secondary-text="dialog.confirmDialogState.secondaryText"
      :primary-tone="dialog.confirmDialogState.primaryTone"
      @primary="dialog.handleConfirmPrimary"
      @secondary="dialog.handleConfirmSecondary"
      @close="dialog.handleConfirmClose"
      @link="dialog.handleConfirmLink"
    />
  </view>
</template>

<style scoped>
.contact-developer-page {
  min-height: 100vh;
  padding: calc(env(safe-area-inset-top) + 30rpx) 24rpx 164rpx;
  background: var(--ui-color-page);
  box-sizing: border-box;
}

.contact-developer-content {
  display: flex;
  flex-direction: column;
  gap: 22rpx;
}

.contact-developer-thanks {
  display: block;
  margin-top: 20rpx;
  color: var(--ui-color-text-muted);
  font-size: 26rpx;
  line-height: 1.6;
  font-weight: 400;
}

.contact-developer-qrcodes {
  display: flex;
  justify-content: center;
  gap: 30rpx;
  margin-top: 26rpx;
}

.contact-developer-qrcode-item {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  max-width: 280rpx;
}

.contact-developer-qrcode {
  display: block;
  width: 100%;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  background: var(--ui-color-surface);
}

.contact-developer-qrcode-caption {
  margin-top: 12rpx;
  color: var(--ui-color-text-muted);
  font-size: 24rpx;
  line-height: 34rpx;
  font-weight: 400;
  text-align: center;
}

.contact-developer-field {
  margin-top: 26rpx;
}

.contact-developer-field__label {
  display: block;
  color: var(--ui-color-text);
  font-size: 26rpx;
  font-weight: 600;
  line-height: 1.4;
}

.contact-developer-field__input,
.contact-developer-field__textarea {
  display: block;
  width: 100%;
  margin-top: 14rpx;
  padding: 18rpx 20rpx;
  border: var(--ui-border-default);
  border-radius: var(--ui-radius-card);
  background: var(--ui-color-surface);
  color: var(--ui-color-text);
  font-size: 28rpx;
  font-weight: 400;
  box-sizing: border-box;
}

/* input 原生控件不会随 padding 自动撑高，固定高度避免 placeholder 被裁切。 */
.contact-developer-field__input {
  height: 84rpx;
  padding: 0 20rpx;
}

.contact-developer-field__textarea {
  height: 160rpx;
}

.contact-developer-field__placeholder {
  color: var(--ui-color-text-muted);
  font-weight: 400;
}

.contact-developer-page :deep(.contact-developer-card) {
  padding: 26rpx 24rpx 30rpx;
}
</style>
