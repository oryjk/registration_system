<script setup lang="ts">
import { useMinioImages } from "@/composables/useMinioImages";
import { resolveMinioImage } from "@/utils/minioImageCache";
import { usePageRefresh } from "@/composables/usePageRefresh";
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

const { minioImageSrc } = useMinioImages();

const { themePageStyle } = useAccentTheme();

const navMetrics = getCustomNavMetrics();
const pageStyle = computed(() => ({
  paddingTop: `${navMetrics.pageTopPadding + 8}px`,
}));

// 审核模式下隐藏打赏入口（小程序审核对打赏类目敏感），仅保留二维码联系区。
const { shouldHideCreationEntrances, preloadMiniReviewStatus } = useMiniReviewStatus();
const {
  amountInput,
  suggestionInput,
  isSubmitting,
  isSubmittingSuggestion,
  isLoggedIn,
  suggestionMaxLength,
  submitSuggestion,
  submitTipDonation,
  dialog,
} = useTipDonation();

const contactImages = [DEVELOPER_WECHAT_QRCODE_URL, OFFICIAL_ACCOUNT_QRCODE_URL];
const supportAmountOptions = [
  { amount: "19.9", label: "喝杯咖啡" },
  { amount: "59.9", label: "吃包耙华华" },
  { amount: "99.9", label: "整包黄金叶" },
];

async function previewContactImage(current: string) {
  const urls = await Promise.all(contactImages.map(resolveMinioImage));
  uni.previewImage({ current: urls[contactImages.indexOf(current)] ?? current, urls });
}

function selectSupportAmount(amount: string) {
  amountInput.value = amount;
}

usePageRefresh(() => preloadMiniReviewStatus(true));
</script>

<template>
  <page-meta :page-style="themePageStyle" />
  <view class="app-theme-scope ui-card-page contact-developer-page" :style="[themePageStyle, pageStyle]">
    <AppTabHeader title="联系开发者" showBack />

    <view class="contact-developer-content">
      <AppSurface custom-class="contact-developer-card">
        <view class="contact-developer-section ui-plain-panel">
          <SectionHeader title="微信与公众号" caption="点击可放大查看 · 长按二维码识别" />
          <view class="contact-developer-qrcodes">
            <view class="contact-developer-qrcode-item">
              <image
                class="contact-developer-qrcode"
                :src="minioImageSrc(DEVELOPER_WECHAT_QRCODE_URL)"
                mode="aspectFit"
                :show-menu-by-longpress="true"
                @tap="previewContactImage(DEVELOPER_WECHAT_QRCODE_URL)"
              />
              <text class="contact-developer-qrcode-caption">加开发者微信</text>
            </view>
            <view class="contact-developer-qrcode-item">
              <image
                class="contact-developer-qrcode"
                :src="minioImageSrc(OFFICIAL_ACCOUNT_QRCODE_URL)"
                mode="aspectFit"
                :show-menu-by-longpress="true"
                @tap="previewContactImage(OFFICIAL_ACCOUNT_QRCODE_URL)"
              />
              <text class="contact-developer-qrcode-caption">关注公众号</text>
            </view>
          </view>
        </view>
      </AppSurface>

      <AppSurface custom-class="contact-developer-card">
        <view class="contact-developer-section ui-plain-panel">
          <SectionHeader title="一起把它做得更好" />
          <text class="contact-developer-thanks">
            有不好用的地方、缺少的功能，或者你想到更好的做法，都欢迎直接告诉我。每一条建议我都会认真看。
          </text>
          <view class="contact-developer-field">
            <text class="contact-developer-field__label">功能建议</text>
            <textarea
              v-model="suggestionInput"
              class="contact-developer-field__textarea"
              :maxlength="suggestionMaxLength"
              placeholder="例如：希望增加赛后聚餐、比赛提醒……"
              placeholder-class="contact-developer-field__placeholder"
            />
          </view>
          <view class="contact-developer-submit">
            <AppButton
              variant="outline"
              block
              :loading="isSubmittingSuggestion"
              :disabled="isSubmittingSuggestion"
              @click="submitSuggestion"
            >
              {{ isSubmittingSuggestion ? "正在提交..." : isLoggedIn ? "提交建议" : "登录后提交建议" }}
            </AppButton>
          </view>
        </view>
      </AppSurface>

      <AppSurface v-if="!shouldHideCreationEntrances" custom-class="contact-developer-card contact-developer-support-card">
        <view class="contact-developer-section ui-plain-panel">
          <SectionHeader title="支持持续开发" caption="完全自愿 · 量力而行" />
          <text class="contact-developer-thanks">
            小程序的维护、问题修复和持续开发都需要投入不少时间和精力。如果它确实帮到了你，一份自愿的支持会让我更有动力把它长期维护下去，也继续把大家真正需要的功能做出来。
          </text>
          <text class="contact-developer-support-note">不支持也完全没关系，正常使用和提交建议都不会受到任何影响。</text>

          <view class="contact-developer-field">
            <text class="contact-developer-field__label">支持金额（元）</text>
            <view class="contact-developer-amount-options">
              <view
                v-for="option in supportAmountOptions"
                :key="option.amount"
                class="contact-developer-amount-option"
                :class="{ 'contact-developer-amount-option--selected': amountInput === option.amount }"
                hover-class="contact-developer-amount-option--pressed"
                @tap="selectSupportAmount(option.amount)"
              >
                <text class="contact-developer-amount-option__price">¥{{ option.amount }}</text>
                <text class="contact-developer-amount-option__label">{{ option.label }}</text>
              </view>
            </view>
            <input
              v-model="amountInput"
              class="contact-developer-field__input"
              type="digit"
              placeholder="也可以输入其他金额"
              placeholder-class="contact-developer-field__placeholder"
            />
          </view>

          <view class="contact-developer-submit">
            <AppButton
              variant="lime"
              block
              :loading="isSubmitting"
              :disabled="isSubmitting"
              @click="submitTipDonation"
            >
              {{ isSubmitting ? "正在拉起支付..." : isLoggedIn ? "支持一下" : "登录后支持" }}
            </AppButton>
          </view>
        </view>
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
@import "@/styles/page-surfaces.css";
@import "@/styles/list-surfaces.css";
/* #ifdef H5 */
.contact-developer-section { display: contents; }
/* #endif */

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
  width: 240rpx;
  height: 240rpx;
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

.contact-developer-support-note {
  display: block;
  margin-top: 12rpx;
  padding: 14rpx 16rpx;
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-neutral-bg);
  color: var(--ui-color-text-muted);
  font-size: 22rpx;
  line-height: 1.5;
}

.contact-developer-field {
  margin-top: 26rpx;
}

.contact-developer-submit {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  margin-top: 22rpx;
}

.contact-developer-field__label {
  display: block;
  color: var(--ui-color-text);
  font-size: 26rpx;
  font-weight: 600;
  line-height: 1.4;
}

.contact-developer-amount-options {
  display: flex;
  gap: 14rpx;
  margin-top: 14rpx;
}

.contact-developer-amount-option {
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  height: 92rpx;
  border-radius: var(--ui-radius-button);
  background: var(--ui-color-neutral-bg);
  color: var(--ui-color-text);
}

.contact-developer-amount-option__price {
  font-size: 26rpx;
  font-weight: 700;
  line-height: 1.2;
}

.contact-developer-amount-option__label {
  margin-top: 6rpx;
  color: var(--ui-color-text-muted);
  font-size: 20rpx;
  font-weight: 400;
  line-height: 1.2;
  white-space: nowrap;
}

.contact-developer-amount-option--selected .contact-developer-amount-option__label {
  color: var(--ui-color-accent-deep);
}

.contact-developer-amount-option--selected {
  background: var(--ui-color-accent-soft);
  color: var(--ui-color-accent-deep);
}

.contact-developer-amount-option--pressed {
  box-shadow: var(--ui-shadow-control-pressed);
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

/* #ifdef MP-WEIXIN */
.contact-developer-page { padding-right: var(--ui-page-padding-inline); padding-left: var(--ui-page-padding-inline); padding-bottom: var(--ui-page-padding-bottom); }
.contact-developer-content { gap: var(--ui-card-gap); }
.contact-developer-section { padding: 0; border: var(--ui-panel-border); border-radius: var(--ui-panel-radius); }
.contact-developer-thanks { margin-top: var(--ui-space-5); font-size: var(--ui-text-label); line-height: var(--ui-line-height-body); }
.contact-developer-qrcodes { gap: var(--ui-space-7); margin-top: var(--ui-space-6); }
.contact-developer-qrcode-item { min-width: 0; }
.contact-developer-qrcode { max-width: 100%; }
.contact-developer-qrcode-caption { margin-top: var(--ui-space-3); font-size: var(--ui-text-body); line-height: var(--ui-line-height-body); }
.contact-developer-support-note { margin-top: var(--ui-space-3); padding: var(--ui-space-3) var(--ui-space-4); border-radius: var(--ui-control-radius); background: var(--ui-panel-soft-bg); font-size: var(--ui-text-sm); line-height: var(--ui-line-height-body); }
.contact-developer-field { margin-top: var(--ui-space-6); }
.contact-developer-submit { margin-top: var(--ui-space-5); }
.contact-developer-field__label { font-size: var(--ui-text-label); font-weight: var(--ui-font-weight-heading); }
.contact-developer-amount-options { gap: var(--ui-space-3); margin-top: var(--ui-space-3); }
.contact-developer-amount-option { min-height: var(--ui-control-min-height); padding: var(--ui-space-3) 0; border-radius: var(--ui-control-radius); background: var(--ui-control-subtle-bg); }
.contact-developer-amount-option--selected { background: var(--ui-control-selected-bg); }
.contact-developer-amount-option__price { font-size: var(--ui-text-label); font-weight: var(--ui-font-weight-heading); }
.contact-developer-amount-option__label { margin-top: var(--ui-space-2); font-size: var(--ui-text-xs); }
.contact-developer-field__input,.contact-developer-field__textarea { margin-top: var(--ui-space-3); padding: var(--ui-space-4) var(--ui-input-padding); border: var(--ui-input-border); border-radius: var(--ui-input-radius); font-size: var(--ui-text-subtitle); }
.contact-developer-field__input { height: var(--ui-input-height); padding: 0 var(--ui-input-padding); }
.contact-developer-field__textarea { min-height: var(--ui-textarea-min-height); }
/* #endif */
</style>
