import { computed, ref } from "vue";
import type { Ref } from "vue";
import { searchImpersonationTargets } from "@/api/auth";
import {
  ensureSessionReady,
  impersonateAsUser,
  restoreImpersonatorSession,
} from "@/stores/appSession";
import type { AppUser } from "@/types/app";
import type { BackendUser } from "@/types/backend";
import { PRODUCT_OWNER_USER_ID } from "@/config/productOwner";
import { isImpersonating } from "@/utils/authStorage";

interface ConfirmOptions {
  title: string;
  content: string;
  confirmText?: string;
  danger?: boolean;
}

interface MineImpersonationOptions {
  currentUser: Ref<BackendUser | null>;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  reload: () => Promise<void>;
}

/** 目标用户展示名：优先昵称，其次实名，兜底用户 ID。 */
export function impersonationTargetLabel(user: AppUser): string {
  const nickname = user.nickname?.trim();
  if (nickname) return nickname;
  const realName = user.real_name?.trim();
  if (realName) return realName;
  return `用户 #${user.id}`;
}

/**
 * 「我的」页身份切换（impersonate）调试面板的状态与动作。
 * 仅产品负责人（PRODUCT_OWNER_USER_ID）可发起切换；切换态以本机暂存的本人 token 为准，
 * 跨页面、重启小程序仍生效，任何用户身份下都会显示「恢复我的身份」入口。
 */
export function useMineImpersonation(options: MineImpersonationOptions) {
  const impersonating = ref(isImpersonating());
  const keyword = ref("");
  const results = ref<AppUser[]>([]);
  const searching = ref(false);
  const switching = ref(false);
  const restoring = ref(false);
  const searched = ref(false);

  const canSwitch = computed(() => options.currentUser.value?.id === PRODUCT_OWNER_USER_ID);
  const panelVisible = computed(() => impersonating.value || canSwitch.value);
  const currentName = computed(() => {
    const user = options.currentUser.value;
    if (!user) return "";
    return user.nickname?.trim() || user.real_name?.trim() || `用户 #${user.id}`;
  });

  /** 每次页面加载同步一次切换态（其它入口清登录态/恢复后保持一致）。 */
  function syncImpersonationState() {
    impersonating.value = isImpersonating();
  }

  async function search() {
    if (searching.value || switching.value) return;
    searching.value = true;
    try {
      const response = await searchImpersonationTargets(keyword.value);
      results.value = response.items;
      searched.value = true;
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "搜索用户失败", icon: "none" });
    } finally {
      searching.value = false;
    }
  }

  async function switchTo(user: AppUser) {
    if (switching.value || searching.value) return;
    const label = impersonationTargetLabel(user);
    const confirmed = await options.confirm({
      title: "切换身份",
      content: `将以「${label}」（ID ${user.id}）的身份使用小程序；你的登录态会暂存本机，可随时在「我的」页顶部恢复。`,
      confirmText: "切换",
    });
    if (!confirmed) return;

    switching.value = true;
    try {
      await impersonateAsUser(user.id);
      impersonating.value = true;
      keyword.value = "";
      results.value = [];
      searched.value = false;
      uni.$emit("session:login-completed");
      await options.reload();
      uni.showToast({ title: `已切换为「${label}」`, icon: "none" });
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "身份切换失败", icon: "none" });
    } finally {
      switching.value = false;
    }
  }

  async function restore() {
    if (restoring.value) return;
    const confirmed = await options.confirm({
      title: "恢复我的身份",
      content: "恢复后将以你本人的身份继续使用小程序。",
      confirmText: "恢复",
    });
    if (!confirmed) return;

    restoring.value = true;
    try {
      try {
        await restoreImpersonatorSession();
      } catch {
        // 原 token 过期等恢复失败场景：登录态已清空，回落到静默重新登录（微信免登）。
        await ensureSessionReady(true);
      }
      impersonating.value = false;
      uni.$emit("session:login-completed");
      await options.reload();
      uni.showToast({ title: "已恢复我的身份", icon: "none" });
    } catch (error) {
      uni.showToast({
        title: error instanceof Error ? error.message : "恢复失败，请重新登录",
        icon: "none",
      });
    } finally {
      restoring.value = false;
    }
  }

  return {
    impersonating,
    impersonationPanelVisible: panelVisible,
    impersonationCanSwitch: canSwitch,
    impersonationCurrentName: currentName,
    impersonationKeyword: keyword,
    impersonationResults: results,
    impersonationSearching: searching,
    impersonationSwitching: switching,
    impersonationRestoring: restoring,
    impersonationSearched: searched,
    syncImpersonationState,
    handleImpersonationSearch: search,
    handleImpersonationSwitch: switchTo,
    handleImpersonationRestore: restore,
  };
}
