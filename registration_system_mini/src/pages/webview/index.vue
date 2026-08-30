<script setup lang="ts">
import { ref } from "vue";
import { onLoad } from "@dcloudio/uni-app";
import { isAllowedWebViewUrl } from "@/utils/webview";

/**
 * 通用 web-view 嵌页：在小程序内打开白名单内的 H5 页面。
 * 通过 `/pages/webview/index?url=<encoded>&title=<可选>` 进入，
 * 业务侧请使用 `navigateToWebView`（会自动桥接登录态），不要手拼路由。
 */
const targetUrl = ref("");

onLoad((query) => {
  // uni-app 已对 query 值做过一次 URL decode，这里直接用原值。
  const url = typeof query?.url === "string" ? query.url.trim() : "";
  const title = typeof query?.title === "string" ? query.title.trim() : "";

  if (title) {
    uni.setNavigationBarTitle({ title });
  }

  if (!url || !isAllowedWebViewUrl(url)) {
    uni.showToast({ title: "链接无效或不支持打开", icon: "none" });
    setTimeout(() => {
      uni.navigateBack({
        fail: () => {
          uni.reLaunch({ url: "/pages/home/index" });
        },
      });
    }, 800);
    return;
  }

  targetUrl.value = url;
});
</script>

<template>
  <!-- web-view 占满整页，页面不使用自定义导航栏；H5 端 uni-app 将其编译为 iframe。 -->
  <web-view v-if="targetUrl" :src="targetUrl" />
</template>
