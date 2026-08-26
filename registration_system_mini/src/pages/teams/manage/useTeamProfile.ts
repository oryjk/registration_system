import { computed, reactive, ref, type ComputedRef, type Ref } from "vue";
import { uploadTeamLogo } from "@/api/team";
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

  const isUploadingLogo = ref(false);

  // 选择图片并上传；后端保存后即写回球队资料，这里同步刷新会话与表单。
  function handleUploadTeamLogo() {
    if (!currentTeam.value || isUploadingLogo.value) return;
    uni.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      success: (res) => {
        const filePath = res.tempFilePaths?.[0];
        if (!filePath) return;
        void (async () => {
          isUploadingLogo.value = true;
          try {
            const logoUrl = await uploadTeamLogo(currentTeam.value!.id, filePath);
            teamProfileForm.logoUrl = logoUrl;
            await refreshSessionContext();
            syncTeamProfileForm();
            uni.showToast({ title: "Logo 已更新", icon: "none" });
          } catch (error) {
            uni.showToast({ title: error instanceof Error ? error.message : "Logo 上传失败", icon: "none" });
          } finally {
            isUploadingLogo.value = false;
          }
        })();
      },
    });
  }

  return {
    teamProfileForm,
    canUpdateTeamProfile,
    isUploadingLogo,
    syncTeamProfileForm,
    handleUpdateTeamProfile,
    handleUploadTeamLogo,
  };
}
