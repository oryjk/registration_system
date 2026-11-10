<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { useMinioImages } from "@/composables/useMinioImages";
import { buildChanlunUrl, sanitizeChanlunReturnQuery } from "@/config/chanlun";
import { ensureSessionReady } from "@/stores/appSession";
import { preloadMiniReviewStatus, useMiniReviewStatus } from "@/stores/miniReview";
import { useAccentTheme } from "@/stores/theme";
import { getAccessToken } from "@/utils/authStorage";
import { DEVELOPER_WECHAT_QRCODE_URL } from "@/utils/developerContact";
import { resolveMinioImage } from "@/utils/minioImageCache";
import { resolveWebViewUrl } from "@/utils/webview";

/**
 * 缠观直接承载页：微信外 URL Link、缠观 H5 内「去登录」都进入本页。
 * 本页直接挂载 <web-view>，不再做二次页面重定向或展示中间加载/重试按钮页，
 * 避免切换过渡期间闪现「进入缠观失败，请重试」按钮或出现双重加载页。
 * 审核中（含正式环境审核状态未知）不加载缠观，改为展示开发者微信二维码。
 */
const { themePageStyle } = useAccentTheme();
const { reviewStatusReady, shouldHideCreationEntrances } = useMiniReviewStatus();
const { minioImageSrc } = useMinioImages();
const targetUrl = ref("");
const showContact = ref(false);

async function openChanlunWebView(returnQuery: string) {
  if (!reviewStatusReady.value) await preloadMiniReviewStatus();
  if (shouldHideCreationEntrances.value) {
    showContact.value = true;
    uni.setNavigationBarTitle({ title: "联系开发者" });
    return;
  }
  if (!getAccessToken()) {
    try {
      await ensureSessionReady();
    } catch {
      // 未登录或网络异常时保持游客态直接进入缠观。
    }
  }
  targetUrl.value = await resolveWebViewUrl(buildChanlunUrl(returnQuery));
}

async function previewQrcode() {
  const url = await resolveMinioImage(DEVELOPER_WECHAT_QRCODE_URL);
  uni.previewImage({ current: url, urls: [url] });
}

onLoad((query) => {
  void openChanlunWebView(sanitizeChanlunReturnQuery(query?.path));
});
</script>

<template>
  <page-meta :page-style="themePageStyle" />
  <view class="app-theme-scope" :style="themePageStyle">
    <view v-if="showContact" class="chanlun-contact">
      <view class="chanlun-contact__card">
        <text class="chanlun-contact__title">联系开发者</text>
        <text class="chanlun-contact__caption">扫码添加开发者微信，点击可放大，长按识别</text>
        <image
          class="chanlun-contact__qrcode"
          :src="minioImageSrc(DEVELOPER_WECHAT_QRCODE_URL)"
          mode="aspectFit"
          :show-menu-by-longpress="true"
          @tap="previewQrcode"
        />
      </view>
    </view>
    <web-view v-else-if="targetUrl" :src="targetUrl" />
  </view>
</template>

<style scoped>
.chanlun-contact { display: flex; justify-content: center; min-height: 100vh; padding: var(--ui-space-10) var(--ui-page-padding-inline); background: var(--ui-color-page); box-sizing: border-box; }
.chanlun-contact__card { display: flex; flex-direction: column; align-items: center; align-self: flex-start; width: 100%; padding: var(--ui-space-8) var(--ui-card-padding); border-radius: var(--ui-card-radius); background: var(--ui-card-bg); box-shadow: var(--ui-card-shadow); box-sizing: border-box; }
.chanlun-contact__title { color: var(--ui-color-text); font-size: var(--ui-text-title); font-weight: var(--ui-font-weight-heading); line-height: var(--ui-line-height-tight); }
.chanlun-contact__caption { margin-top: var(--ui-space-2); color: var(--ui-color-text-muted); font-size: var(--ui-text-sm); line-height: var(--ui-line-height-compact); text-align: center; }
.chanlun-contact__qrcode { width: 360rpx; height: 360rpx; margin-top: var(--ui-space-6); border-radius: var(--ui-radius-card); background: var(--ui-color-surface); }
</style>
