import { computed, reactive, type ComputedRef, type Ref } from "vue";
import type { TeamProfileViewModel } from "@/types/viewModels";
import { saveTeamProfile } from "./teamManageActions";

interface TeamProfileDependencies {
  currentTeam: ComputedRef<TeamProfileViewModel | null>;
  submitting: Ref<boolean>;
  refreshSessionContext: () => Promise<void>;
}

export function useTeamProfile({ currentTeam, submitting, refreshSessionContext }: TeamProfileDependencies) {
  const teamProfileForm = reactive({ name: "", description: "", logoUrl: "" });
  const canUpdateTeamProfile = computed(
    () => !!currentTeam.value?.canManageTeam && !!teamProfileForm.name.trim() && !submitting.value,
  );

  function syncTeamProfileForm() {
    teamProfileForm.name = currentTeam.value?.name ?? "";
    teamProfileForm.description = currentTeam.value?.description ?? "";
    teamProfileForm.logoUrl = currentTeam.value?.logoUrl ?? "";
  }

  async function handleUpdateTeamProfile() {
    if (!currentTeam.value || !canUpdateTeamProfile.value) {
      uni.showToast({ title: "请先补全球队名称", icon: "none" });
      return;
    }

    submitting.value = true;
    try {
      await saveTeamProfile(currentTeam.value.id, {
        name: teamProfileForm.name.trim(),
        description: teamProfileForm.description.trim() || null,
        logoUrl: teamProfileForm.logoUrl.trim() || null,
      });
      await refreshSessionContext();
      syncTeamProfileForm();
      uni.showToast({ title: "球队资料已保存", icon: "none" });
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "保存球队资料失败", icon: "none" });
    } finally {
      submitting.value = false;
    }
  }

  return {
    teamProfileForm,
    canUpdateTeamProfile,
    syncTeamProfileForm,
    handleUpdateTeamProfile,
  };
}
