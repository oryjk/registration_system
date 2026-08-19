<script setup lang="ts">
import { computed } from "vue";
import AppTabHeader from "@/components/AppTabHeader.vue";
import NeoButton from "@/components/neo/NeoButton.vue";
import NeoConfirmDialog from "@/components/neo/NeoConfirmDialog.vue";
import NeoSectionHeader from "@/components/neo/NeoSectionHeader.vue";
import NeoSurface from "@/components/neo/NeoSurface.vue";
import { useMiniReviewStatus } from "@/stores/miniReview";
import { DEVELOPER_WECHAT_QRCODE_URL, OFFICIAL_ACCOUNT_QRCODE_URL } from "@/utils/developerContact";
import { getCustomNavMetrics } from "@/utils/customNav";
import { TIP_MAX_YUAN, TIP_MIN_YUAN, useTipDonation } from "./useTipDonation";

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
  <view class="contact-developer-page" :style="pageStyle">
    <AppTabHeader title="联系开发者" showBack />

    <view class="contact-developer-content">
      <NeoSurface custom-class="contact-developer-card">
        <NeoSectionHeader title="联系开发者" marker="联" caption="长按二维码识别" />
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
      </NeoSurface>

      <NeoSurface v-if="!shouldHideCreationEntrances" custom-class="contact-developer-card">
        <NeoSectionHeader title="请开发者喝咖啡" marker="咖" caption="可选金额 · 可留功能建议" />
        <text class="contact-developer-thanks">
          如果这个小程序帮到了你，可以请开发者喝杯咖啡。你的支持是我持续迭代的动力，也欢迎顺手写下你希望拥有的功能。
        </text>

        <view class="contact-developer-field">
          <text class="contact-developer-field__label">打赏金额（元）</text>
          <input
            v-model="amountInput"
            class="contact-developer-field__input"
            type="digit"
            :placeholder="`任意金额 ${TIP_MIN_YUAN} ~ ${TIP_MAX_YUAN} 元`"
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

        <NeoButton
          variant="lime"
          block
          :loading="isSubmitting"
          :disabled="isSubmitting"
          @click="submitTipDonation"
        >
          {{ isSubmitting ? "正在拉起支付..." : isLoggedIn ? "请喝咖啡" : "登录后请喝咖啡" }}
        </NeoButton>
      </NeoSurface>
    </view>

    <NeoConfirmDialog
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
  background: var(--neo-color-page);
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
  color: var(--neo-color-text-muted);
  font-size: 26rpx;
  line-height: 1.6;
  font-weight: 700;
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
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
}

.contact-developer-qrcode-caption {
  margin-top: 12rpx;
  color: var(--neo-color-text-muted);
  font-size: 24rpx;
  line-height: 34rpx;
  font-weight: 700;
  text-align: center;
}

.contact-developer-field {
  margin-top: 26rpx;
}

.contact-developer-field__label {
  display: block;
  color: var(--neo-color-text);
  font-size: 26rpx;
  font-weight: 900;
  line-height: 1.4;
}

.contact-developer-field__input,
.contact-developer-field__textarea {
  display: block;
  width: 100%;
  margin-top: 14rpx;
  padding: 18rpx 20rpx;
  border: var(--neo-border-default);
  border-radius: var(--neo-radius-md);
  background: var(--neo-color-surface);
  color: var(--neo-color-text);
  font-size: 28rpx;
  font-weight: 700;
  box-sizing: border-box;
}

.contact-developer-field__textarea {
  height: 160rpx;
}

.contact-developer-field__placeholder {
  color: var(--neo-color-text-muted);
  font-weight: 700;
}

.contact-developer-page :deep(.contact-developer-card) {
  padding: 26rpx 24rpx 30rpx;
}
</style>
