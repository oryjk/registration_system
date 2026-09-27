import { hasManualLogout } from "@/utils/authStorage";
import { usePageRefresh } from "@/composables/usePageRefresh";
import { computed, reactive, ref, watch } from "vue";
import { onShow } from "@dcloudio/uni-app";
import { uploadTeamLogo } from "@/api/team";
import { getCustomNavMetrics } from "@/utils/customNav";
import { useTeamContext } from "@/stores/teamContext";
import { preloadMiniReviewStatus, useMiniReviewStatus } from "@/stores/miniReview";
import { createTeamFromForm } from "../teamSelfActions";

const reviewTeamNameOptions = ["星火联队", "周末竞技 FC", "白银风暴", "东城野球会", "黑曜九号"];

// 创建球队独立页：对已有球队的用户同样开放（一人可创建多支球队），成功后自动切到新球队。
export function useTeamCreatePage() {
  const { currentUser, currentTeam, ensureSessionReady, refreshSessionContext, switchTeam } = useTeamContext();
  const { reviewMode, shouldHideCreationEntrances } = useMiniReviewStatus();
  const navMetrics = getCustomNavMetrics();

  const submitting = ref(false);
  const createTeamReviewMode = reviewMode;
  const createForm = reactive({ name: "", description: "", joinPassword: "" });
  let successUserId: number | undefined;
  const createdTeamId = ref<number | null>(null);
  const nextStepBusy = ref(false);
  const canArrangeMatch = computed(() => !shouldHideCreationEntrances.value);
  const canCreate = computed(() => !!createForm.name.trim() && !submitting.value && !createdTeamId.value && !shouldHideCreationEntrances.value);
  watch(() => currentUser.value?.id, (id) => {
    if (successUserId && !hasManualLogout() && (!id || id === successUserId)) return;
    successUserId = undefined;
    createdTeamId.value = null;
    createForm.name = "";
    createForm.description = "";
    createForm.joinPassword = "";
    logoLocalPath.value = "";
  });
  const pageStyle = computed(() => ({ paddingTop: `${navMetrics.pageTopPadding + 8}px` }));
  // 可选 Logo：创建时只存本地临时路径做预览，球队创建成功后再走 /teams/:id/logo 上传。
  const logoLocalPath = ref("");

  function goJoinTeam() {
    uni.navigateTo({ url: "/pages/teams/join/index" });
  }

  function handlePickLogo() {
    uni.chooseImage({
      count: 1,
      sizeType: ["compressed"],
      success: (result) => {
        const filePath = result.tempFilePaths?.[0];
        if (filePath) {
          logoLocalPath.value = filePath;
        }
      },
    });
  }

  function handleRemoveLogo() {
    logoLocalPath.value = "";
  }

  // 刷新失败可暂时清空会话；成功结果仍属于原账号，不能因此再次提交。
  async function restoreSuccessAccount(): Promise<boolean> {
    const ownerId = successUserId;
    if (hasManualLogout()) {
      successUserId = undefined;
      createdTeamId.value = null;
      return false;
    }
    if (!ownerId) return false;
    try {
      await ensureSessionReady();
      if (hasManualLogout() || currentUser.value?.id !== ownerId) {
        uni.showToast({ title: "请恢复原账号后继续", icon: "none" });
        return false;
      }
      return true;
    } catch {
      uni.showToast({ title: "操作已成功，请稍后重试下一步", icon: "none" });
      return false;
    }
  }

  async function goInviteTeam() {
    if (!createdTeamId.value || !(await restoreSuccessAccount())) return;
    uni.navigateTo({ url: `/pages/teams/detail/index?teamId=${createdTeamId.value}` });
  }

  async function goArrangeMatch() {
    if (!createdTeamId.value || nextStepBusy.value || !canArrangeMatch.value) return;
    const teamId = createdTeamId.value;
    const userId = successUserId;
    nextStepBusy.value = true;
    try {
      if (!(await restoreSuccessAccount())) return;
      await refreshSessionContext();
      await preloadMiniReviewStatus();
      if (userId !== currentUser.value?.id || createdTeamId.value !== teamId || !canArrangeMatch.value) return;
      switchTeam(teamId);
      if (currentTeam.value?.id !== teamId) throw new Error("球队信息尚未同步，请稍后重试");
      await uni.navigateTo({ url: "/pages/matches/create/index" });
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "暂时无法打开比赛创建，请重试", icon: "none" });
    } finally {
      nextStepBusy.value = false;
    }
  }

  async function handleCreateTeam() {
    if (submitting.value || createdTeamId.value) return;
    if (!canCreate.value) {
      uni.showToast({ title: "请输入球队名称", icon: "none" });
      return;
    }
    const userId = currentUser.value?.id;
    submitting.value = true;
    try {
      const created = await createTeamFromForm({
        name: createForm.name.trim(),
        description: createTeamReviewMode.value ? undefined : createForm.description.trim() || undefined,
        joinPassword: createForm.joinPassword.trim() || undefined,
      });
      if (userId !== currentUser.value?.id) return;
      successUserId = userId;
      createdTeamId.value = created.id;
      // Logo 依赖 teamId，只能在球队创建后上传；失败不阻断主流程（可稍后在球队管理中补传）。
      if (logoLocalPath.value) {
        try {
          await uploadTeamLogo(created.id, logoLocalPath.value);
        } catch (_logoError) {
          uni.showToast({
            title: "球队已创建，Logo 上传失败，可稍后在球队管理中上传",
            icon: "none",
            duration: 2500,
          });
        }
      }
      try {
        await refreshSessionContext();
        if (userId === currentUser.value?.id) switchTeam(created.id);
      } catch {
        // 创建已经成功；上下文同步失败不回退为可重复提交的表单。
        uni.showToast({ title: "球队已创建，球队列表稍后刷新", icon: "none" });
      }
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "创建球队失败", icon: "none" });
    } finally {
      submitting.value = false;
    }
  }

  usePageRefresh(() => refreshSessionContext());

  onShow(async () => {
    if (hasManualLogout()) {
      await restoreSuccessAccount();
      return;
    }
    await ensureSessionReady();
    await preloadMiniReviewStatus();
    // 审核模式隐藏创建入口：直达本页时兜底跳到加入页。
    if (shouldHideCreationEntrances.value && !createdTeamId.value) {
      uni.redirectTo({ url: "/pages/teams/join/index" });
      return;
    }
    if (createTeamReviewMode.value && !reviewTeamNameOptions.includes(createForm.name)) {
      createForm.name = reviewTeamNameOptions[0] || "";
      createForm.description = "";
    }
  });

  return {
    pageStyle,
    createForm,
    createTeamReviewMode,
    reviewTeamNameOptions,
    canCreate,
    submitting,
    logoLocalPath,
    handlePickLogo,
    handleRemoveLogo,
    createdTeamId,
    nextStepBusy,
    canArrangeMatch,
    goInviteTeam,
    goArrangeMatch,
    handleCreateTeam,
    goJoinTeam,
  };
}
