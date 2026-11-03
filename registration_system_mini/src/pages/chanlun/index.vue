<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import AppButton from "@/components/ui/AppButton.vue";
import RunningLoader from "@/components/ui/RunningLoader.vue";
import { buildChanlunUrl, sanitizeChanlunReturnQuery } from "@/config/chanlun";
import { ensureSessionReady } from "@/stores/appSession";
import { useAccentTheme } from "@/stores/theme";
import { navigateToWebView } from "@/utils/webview";

/**
 * 缠观落地页：「我的」入口、微信外 URL Link、缠观 H5 内「去登录」都汇聚到这里。
 * 先完成小程序默认登录，再以 web-view 替换本页打开缠观（携带一次性 code），
 * `path` 为回到缠观时附带的查询串。登录失败时以游客身份进入，不阻断浏览。
 */
const { themePageStyle } = useAccentTheme();
const entering = ref(true);
let returnQuery = "";

async function enterChanlun() {
  entering.value = true;
  try {
    await ensureSessionReady();
  } catch {
    // 未登录或已手动退出：保持游客态进入，缠观内需要登录的功能会再提示。
  }
  await navigateToWebView(buildChanlunUrl(returnQuery), "缠观", { replace: true });
  // 跳转成功时本页已被替换；仍停留说明登录态同步失败，提供重试。
  entering.value = false;
}

onLoad((query) => {
  returnQuery = sanitizeChanlunReturnQuery(query?.path);
  void enterChanlun();
});
</script>

<template>
  <page-meta :page-style="themePageStyle" />
  <view class="app-theme-scope chanlun-landing" :style="themePageStyle">
    <RunningLoader v-if="entering" text="正在进入缠观" />
    <view v-else class="chanlun-landing-retry">
      <text>进入缠观失败，请重试</text>
      <AppButton @click="enterChanlun">重新进入</AppButton>
    </view>
  </view>
</template>

<style scoped>
.chanlun-landing { min-height: 100vh; display: flex; align-items: center; justify-content: center; }
.chanlun-landing-retry { display: flex; flex-direction: column; align-items: center; gap: 32rpx; color: var(--ui-color-text-muted); font-size: var(--ui-text-body); }
</style>
