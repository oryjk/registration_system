<script setup lang="ts">
import { onHide, onLaunch, onPageNotFound, onShow } from "@dcloudio/uni-app";
import { ensureSessionReady, useAppSession } from "@/stores/appSession";
import { preloadMiniReviewStatus } from "@/stores/miniReview";
import { isProfileSetupPage, needsProfileCompletion, PROFILE_SETUP_PAGE_PATH } from "@/utils/profileCompletion";

const HOME_PAGE_PATH = "/pages/home/index";
const { currentUser } = useAppSession();
let profileSetupNavigationPending = false;

function currentPageRoute() {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1];
  return currentPage?.route || "";
}

function maybeNavigateToProfileSetup() {
  if (profileSetupNavigationPending) return;
  if (!needsProfileCompletion(currentUser.value)) return;
  if (isProfileSetupPage(currentPageRoute())) return;

  profileSetupNavigationPending = true;
  uni.navigateTo({
    url: PROFILE_SETUP_PAGE_PATH,
    complete: () => {
      setTimeout(() => {
        profileSetupNavigationPending = false;
      }, 200);
    },
  });
}

onLaunch(() => {
  console.log("registration_system_mini launch");
  void preloadMiniReviewStatus();
  ensureSessionReady()
    .then(() => {
      maybeNavigateToProfileSetup();
    })
    .catch((error) => {
      console.warn("session bootstrap failed", error);
    });
});

onShow(() => {
  console.log("registration_system_mini show");
  maybeNavigateToProfileSetup();
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
