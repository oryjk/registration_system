<script setup lang="ts">
import { onHide, onLaunch, onPageNotFound, onShow } from "@dcloudio/uni-app";
import { ensureSessionReady } from "@/stores/appSession";
import { preloadMiniReviewStatus } from "@/stores/miniReview";
import { setupMiniProgramUpdatePrompt } from "@/utils/updateManager";

const HOME_PAGE_PATH = "/pages/home/index";

onLaunch(() => {
  console.log("registration_system_mini launch");
  setupMiniProgramUpdatePrompt();
  void preloadMiniReviewStatus();
  ensureSessionReady().catch((error) => {
    console.warn("session bootstrap failed", error);
  });
});

onShow(() => {
  console.log("registration_system_mini show");
});

onHide(() => {
  console.log("registration_system_mini hide");
});

onPageNotFound((options) => {
  console.warn("page not found, relaunch home", options);
  uni.reLaunch({
    url: HOME_PAGE_PATH,
  });
});
</script>

<style>
@import "./styles/neo-tokens.css";
@import "./uni.css";

page {
  min-height: 100%;
  background: var(--neo-color-page);
  color: var(--neo-color-text);
  font-family: "PingFang SC", "Helvetica Neue", sans-serif;
}

view,
text,
button,
input,
textarea,
scroll-view {
  box-sizing: border-box;
}

button {
  margin: 0;
}
</style>
