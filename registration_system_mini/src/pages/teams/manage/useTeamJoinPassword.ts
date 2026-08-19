import { computed, reactive, ref, type ComputedRef, type Ref } from "vue";
import type { TeamProfileViewModel } from "@/types/viewModels";
import { checkTeamRequiresPassword } from "../teamSelfActions";
import { updateJoinPasswordFromForm } from "./teamManageActions";

interface TeamJoinPasswordDependencies {
  currentTeam: ComputedRef<TeamProfileViewModel | null>;
  submitting: Ref<boolean>;
}

// 队长/领队设置、更换、清除入队密码；保存成功后刷新当前状态并清空输入。
export function useTeamJoinPassword({ currentTeam, submitting }: TeamJoinPasswordDependencies) {
  const joinPasswordForm = reactive({ password: "" });
  const requiresPassword = ref(false);
  const canSubmitJoinPassword = computed(() => !submitting.value);

  async function syncJoinPasswordStatus() {
    if (!currentTeam.value) return;
    try {
      requiresPassword.value = await checkTeamRequiresPassword(currentTeam.value.id);
    } catch (_error) {
      requiresPassword.value = false;
    }
  }

  async function handleUpdateJoinPassword() {
    if (!currentTeam.value || submitting.value) return;
    if (!joinPasswordForm.password.trim()) {
      uni.showToast({ title: "请输入新密码", icon: "none" });
      return;
    }
    submitting.value = true;
    try {
      await updateJoinPasswordFromForm(currentTeam.value.id, joinPasswordForm.password);
      joinPasswordForm.password = "";
      await syncJoinPasswordStatus();
      uni.showToast({ title: "入队密码已更新", icon: "none" });
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "更新入队密码失败", icon: "none" });
    } finally {
      submitting.value = false;
    }
  }

  function handleClearJoinPassword() {
    if (!currentTeam.value || submitting.value) return;
    uni.showModal({
      title: "清除入队密码",
      content: "清除后任何人搜索到球队即可直接加入，确定继续吗？",
      confirmText: "清除",
      success: (result) => {
        if (result.confirm) void doClearJoinPassword();
      },
    });
  }

  async function doClearJoinPassword() {
    if (!currentTeam.value || submitting.value) return;
    submitting.value = true;
    try {
      await updateJoinPasswordFromForm(currentTeam.value.id, "");
      await syncJoinPasswordStatus();
      uni.showToast({ title: "已改为开放加入", icon: "none" });
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "清除入队密码失败", icon: "none" });
    } finally {
      submitting.value = false;
    }
  }

  return {
    joinPasswordForm,
    requiresPassword,
    canSubmitJoinPassword,
    syncJoinPasswordStatus,
    handleUpdateJoinPassword,
    handleClearJoinPassword,
  };
}
