import { computed, type ComputedRef, type Ref } from "vue";
import { useMiniReviewStatus } from "@/stores/miniReview";
import type { TeamProfileViewModel } from "@/types/viewModels";
import type { NeoConfirmDialogLinkOptions } from "@/components/neo";
import { useNeoConfirmDialog } from "@/components/neo";
import type { TeamDissolveBlockers } from "@/api/team";
import { dissolveTeam, loadTeamDissolveBlockers } from "./teamManageActions";

interface TeamDissolveDependencies {
  currentTeam: ComputedRef<TeamProfileViewModel | null>;
  submitting: Ref<boolean>;
  refreshSessionContext: () => Promise<void>;
}

/** 解散球队：仅队长本人；先做引用预检查，有阻塞项时给处理链接，无阻塞再 danger 确认。 */
export function useTeamDissolve({ currentTeam, submitting, refreshSessionContext }: TeamDissolveDependencies) {
  const { shouldHideCreationEntrances } = useMiniReviewStatus();
  const {
    confirmDialogVisible: dissolveDialogVisible,
    confirmDialogState: dissolveDialogState,
    confirm,
    alert,
    handleConfirmPrimary: handleDissolvePrimary,
    handleConfirmSecondary: handleDissolveSecondary,
    handleConfirmClose: handleDissolveClose,
    handleConfirmLinkItem: handleDissolveLinkItem,
  } = useNeoConfirmDialog();

  // 解散不可恢复：只给队长本人，且小程序审核模式下隐藏入口。
  const canDissolveTeam = computed(
    () => !!currentTeam.value?.isCaptain && !shouldHideCreationEntrances.value && !submitting.value,
  );

  /** 阻塞项 → 处理链接：主队比赛去详情页收尾/取消；约队申请去接约页撤回；
   * 客队比赛若已有对应申请入口则去重（撤回申请即可解除引用）。 */
  function buildBlockerLinks(blockers: TeamDissolveBlockers): NeoConfirmDialogLinkOptions[] {
    const applicationMatchIds = new Set(blockers.applications.map((application) => application.match_id));
    const links: NeoConfirmDialogLinkOptions[] = [];
    for (const match of blockers.matches) {
      if (!match.is_host && applicationMatchIds.has(match.id)) continue;
      links.push({
        text: match.is_host ? `去处理比赛「${match.name}」` : `查看比赛「${match.name}」`,
        onTap: () => uni.navigateTo({ url: `/pages/matches/detail?id=${match.id}` }),
      });
    }
    for (const application of blockers.applications) {
      links.push({
        text: `去取消约队「${application.match_name}」`,
        onTap: () => uni.navigateTo({ url: `/pages/matches/apply-team/index?id=${application.match_id}` }),
      });
    }
    return links;
  }

  async function handleDissolveTeam() {
    const team = currentTeam.value;
    if (!team) return;

    submitting.value = true;
    let blockers: TeamDissolveBlockers;
    try {
      blockers = await loadTeamDissolveBlockers(team.id);
    } catch (error) {
      await alert({
        title: "解散球队失败",
        content: error instanceof Error ? error.message : "请稍后重试",
      });
      return;
    } finally {
      submitting.value = false;
    }

    if (blockers.matches.length > 0 || blockers.applications.length > 0) {
      await alert({
        title: "暂时无法解散球队",
        content: "以下比赛或约队申请仍在进行中，处理完成后才能解散：",
        links: buildBlockerLinks(blockers),
      });
      return;
    }

    const confirmed = await confirm({
      title: "解散球队",
      content: `确定解散「${team.name}」吗？解散后球队将从全体成员的球队列表中移除，且无法恢复。`,
      highlight: team.name,
      confirmText: "解散",
      cancelText: "再想想",
      danger: true,
    });
    if (!confirmed) return;

    submitting.value = true;
    try {
      await dissolveTeam(team.id);
      await refreshSessionContext();
      uni.showToast({ title: "球队已解散", icon: "none" });
      // 上一页多半是这支（已解散）球队的详情/管理页，返回会因球队不再可访问而报无权限；
      // 直接回到「我的」，球队列表已刷新且不再包含该队。
      setTimeout(() => uni.switchTab({ url: "/pages/user/index" }), 600);
    } catch (error) {
      // 预检查通过后仍可能被并发操作抢先（如刚提交的新约队申请），展示后端 409 文案。
      await alert({
        title: "解散球队失败",
        content: error instanceof Error ? error.message : "请稍后重试",
      });
    } finally {
      submitting.value = false;
    }
  }

  return {
    canDissolveTeam,
    dissolveDialogVisible,
    dissolveDialogState,
    handleDissolveTeam,
    handleDissolvePrimary,
    handleDissolveSecondary,
    handleDissolveClose,
    handleDissolveLinkItem,
  };
}
