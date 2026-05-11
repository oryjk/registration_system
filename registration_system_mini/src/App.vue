<script setup lang="ts">
import { onHide, onLaunch, onShow } from "@dcloudio/uni-app";
import { ensureSessionReady, useAppSession } from "@/stores/appSession";
import { syncUnreadCount } from "@/stores/notificationCenter";
import { isProfileSetupPage, needsProfileCompletion, PROFILE_SETUP_PAGE_PATH } from "@/utils/profileCompletion";

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
  ensureSessionReady()
    .then(async () => {
      await syncUnreadCount({ skipEnsure: true });
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
</script>

<style>
@import "./uni.css";

page {
  min-height: 100%;
  background: #f3f4f6;
  color: #111827;
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
