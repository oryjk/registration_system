import { computed, reactive, ref, type ComputedRef, type Ref } from "vue";
import type { TeamProfileViewModel } from "@/types/viewModels";
import { saveTeamProfile, uploadCurrentTeamLogo } from "./teamManageActions";

interface TeamProfileDependencies {
  currentTeam: ComputedRef<TeamProfileViewModel | null>;
  submitting: Ref<boolean>;
  refreshSessionContext: () => Promise<void>;
}

export function useTeamProfile({ currentTeam, submitting, refreshSessionContext }: TeamProfileDependencies) {
  const teamProfileForm = reactive({ name: "", description: "", logoUrl: "" });
  const logoUploading = ref(false);
  const maxLogoSizeBytes = 1024 * 1024;
  const canUpdateTeamProfile = computed(
    () => !!currentTeam.value?.canManageTeam && !!teamProfileForm.name.trim() && !submitting.value,
  );

  function syncTeamProfileForm() {
    teamProfileForm.name = currentTeam.value?.name ?? "";
    teamProfileForm.description = currentTeam.value?.description ?? "";
    teamProfileForm.logoUrl = currentTeam.value?.logoUrl ?? "";
  }

  async function resolveUploadableLogoPath(filePath: string) {
    const original = await uni.getFileInfo({ filePath });
    if ((original.size ?? 0) <= maxLogoSizeBytes) return filePath;

    const compressed = await uni.compressImage({ src: filePath, quality: 75 });
    const compressedPath = compressed.tempFilePath || filePath;
    const compressedInfo = await uni.getFileInfo({ filePath: compressedPath });
    if ((compressedInfo.size ?? 0) <= maxLogoSizeBytes) return compressedPath;
    throw new Error("球队 Logo 不能超过 1MB，请换一张图片");
  }

  async function handleChooseTeamLogo() {
    if (!currentTeam.value || logoUploading.value) return;
    try {
      const result = await uni.chooseImage({ count: 1, sizeType: ["compressed"], sourceType: ["album", "camera"] });
      const filePath = result.tempFilePaths?.[0] || "";
      if (!filePath) return;

      logoUploading.value = true;
      uni.showLoading({ title: "上传 Logo 中...", mask: true });
      const uploadPath = await resolveUploadableLogoPath(filePath);
      const uploaded = await uploadCurrentTeamLogo(currentTeam.value.id, uploadPath);
      teamProfileForm.logoUrl = uploaded.logo_url;
      await refreshSessionContext();
      syncTeamProfileForm();
      uni.hideLoading();
      uni.showToast({ title: "Logo 已上传", icon: "none" });
    } catch (error) {
      uni.hideLoading();
      uni.showToast({ title: error instanceof Error ? error.message : "Logo 上传失败", icon: "none" });
    } finally {
      logoUploading.value = false;
    }
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
    logoUploading,
    canUpdateTeamProfile,
    syncTeamProfileForm,
    handleChooseTeamLogo,
    handleUpdateTeamProfile,
  };
}
