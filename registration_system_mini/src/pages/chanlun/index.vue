<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { buildChanlunUrl, sanitizeChanlunReturnQuery } from "@/config/chanlun";
import { ensureSessionReady } from "@/stores/appSession";
import { useAccentTheme } from "@/stores/theme";
import { getAccessToken } from "@/utils/authStorage";
import { resolveWebViewUrl } from "@/utils/webview";

/**
 * 缠观直接承载页：微信外 URL Link、缠观 H5 内「去登录」都进入本页。
 * 本页直接挂载 <web-view>，不再做二次页面重定向或展示中间加载/重试按钮页，
 * 避免切换过渡期间闪现「进入缠观失败，请重试」按钮或出现双重加载页。
 */
const { themePageStyle } = useAccentTheme();
const targetUrl = ref("");

async function openChanlunWebView(returnQuery: string) {
  if (!getAccessToken()) {
    try {
      await ensureSessionReady();
    } catch {
      // 未登录或网络异常时保持游客态直接进入缠观。
    }
  }
  targetUrl.value = await resolveWebViewUrl(buildChanlunUrl(returnQuery));
}

onLoad((query) => {
  void openChanlunWebView(sanitizeChanlunReturnQuery(query?.path));
});
</script>

<template>
  <page-meta :page-style="themePageStyle" />
  <view class="app-theme-scope" :style="themePageStyle">
    <web-view v-if="targetUrl" :src="targetUrl" />
  </view>
</template>
