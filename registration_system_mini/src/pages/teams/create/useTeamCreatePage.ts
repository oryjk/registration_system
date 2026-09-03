import { computed, reactive, ref } from "vue";
import { onLoad, onShow } from "@dcloudio/uni-app";
import { uploadTeamLogo } from "@/api/team";
import { getCustomNavMetrics } from "@/utils/customNav";
import { useTeamContext } from "@/stores/teamContext";
import { preloadMiniReviewStatus, useMiniReviewStatus } from "@/stores/miniReview";
import { createTeamFromForm } from "../teamSelfActions";

const reviewTeamNameOptions = ["星火联队", "周末竞技 FC", "白银风暴", "东城野球会", "黑曜九号"];

// 创建球队独立页：对已有球队的用户同样开放（一人可创建多支球队），成功后自动切到新球队。
export function useTeamCreatePage() {
  const { ensureSessionReady, refreshSessionContext, switchTeam } = useTeamContext();
  const { reviewMode, shouldHideCreationEntrances } = useMiniReviewStatus();
  const navMetrics = getCustomNavMetrics();

  const submitting = ref(false);
  const createTeamReviewMode = reviewMode;
  const createForm = reactive({ name: "", description: "", joinPassword: "" });
  // 来自首页新手引导（from=onboarding）：创建成功后提示分享邀请并落到球队详情页。
  let openedFromOnboarding = false;
  // 分享提示用自绘 NeoConfirmDialog 呈现：原生 showModal 的按钮文案限制 4 个汉字，
  // 「去邀请队员」5 字会导致弹窗静默失败。
  const onboardingShareTeamId = ref<number | null>(null);
  const onboardingShareVisible = computed(() => onboardingShareTeamId.value !== null);
  const canCreate = computed(() => !!createForm.name.trim() && !submitting.value);
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

  function handleOnboardingShareConfirmed() {
    const teamId = onboardingShareTeamId.value;
    onboardingShareTeamId.value = null;
    if (!teamId) return;
    uni.redirectTo({ url: `/pages/teams/detail/index?teamId=${teamId}` });
  }

  function handleOnboardingShareDeclined() {
    onboardingShareTeamId.value = null;
    uni.switchTab({ url: "/pages/user/index" });
  }

  async function handleCreateTeam() {
    if (!canCreate.value) {
      uni.showToast({ title: "请输入球队名称", icon: "none" });
      return;
    }
    submitting.value = true;
    try {
      const created = await createTeamFromForm({
        name: createForm.name.trim(),
        description: createTeamReviewMode.value ? undefined : createForm.description.trim() || undefined,
        joinPassword: createForm.joinPassword.trim() || undefined,
      });
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
      await refreshSessionContext();
      // 创建第二支球队后自动切到新球队，避免仍停留在原球队上下文。
      switchTeam(created.id);
      if (openedFromOnboarding) {
        onboardingShareTeamId.value = created.id;
        return;
      }
      uni.showToast({ title: "球队已创建", icon: "none" });
      uni.switchTab({ url: "/pages/user/index" });
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "创建球队失败", icon: "none" });
    } finally {
      submitting.value = false;
    }
  }

  onLoad((options) => {
    openedFromOnboarding = options?.from === "onboarding";
  });

  onShow(async () => {
    await ensureSessionReady();
    await preloadMiniReviewStatus();
    // 审核模式隐藏创建入口：直达本页时兜底跳到加入页。
    if (shouldHideCreationEntrances.value) {
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
    onboardingShareVisible,
    handleOnboardingShareConfirmed,
    handleOnboardingShareDeclined,
    handleCreateTeam,
    goJoinTeam,
  };
}
