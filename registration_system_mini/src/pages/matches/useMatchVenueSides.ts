import { computed, ref, type ComputedRef, type Ref } from "vue";
import { claimVenueSide, removeVenueSide, withdrawVenueSide } from "@/api/venueSide";
import type { ConfirmDialogOptions } from "@/components/ui";
import type { AppMatchGroupDetail, AppMatchSummary } from "@/types/match";
import { canClaimVenueSide, toVenueSideCards, type VenueSideCard } from "./venueSideState";

interface MatchVenueSidesDependencies {
  sourceMatch: Ref<AppMatchSummary | null>;
  groups: Ref<AppMatchGroupDetail[]>;
  viewer: ComputedRef<{ userId?: number; teamId?: number | null; canManageTeam?: boolean }>;
  nowTick: Ref<number>;
  registrationOpen: ComputedRef<boolean>;
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  reload: (options?: { preserveContent?: boolean }) => Promise<void>;
}

/** 场馆组局详情的两边状态和占边、退出、移出动作；业务 API 只在这里调用。 */
export function useMatchVenueSides(dependencies: MatchVenueSidesDependencies) {
  const { sourceMatch, groups, viewer, nowTick, registrationOpen, confirm, reload } = dependencies;
  const venueSideBusy = ref(false);

  const isVenueMatch = computed(() => sourceMatch.value?.publication_mode === "venue_hosted");
  const venueSideCards = computed(() => (sourceMatch.value && isVenueMatch.value
    ? toVenueSideCards(sourceMatch.value, groups.value, viewer.value, nowTick.value)
    : []));
  const canClaimSide = computed(() => !!sourceMatch.value && isVenueMatch.value
    && canClaimVenueSide(sourceMatch.value, groups.value, viewer.value, registrationOpen.value));

  async function run(operation: () => Promise<unknown>, successTitle: string) {
    if (venueSideBusy.value) return;
    venueSideBusy.value = true;
    uni.showLoading({ title: "提交中...", mask: true });
    try {
      await operation();
      await reload({ preserveContent: true });
      uni.$emit("home:data-may-changed");
      uni.showToast({ title: successTitle, icon: "none" });
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "操作失败", icon: "none" });
    } finally {
      uni.hideLoading();
      venueSideBusy.value = false;
    }
  }

  async function handleClaimSide() {
    const matchId = sourceMatch.value?.id;
    const teamId = viewer.value.teamId;
    if (!matchId || teamId == null) return;
    const confirmed = await confirm({
      title: "带队报名",
      content: "占下这一边后，队员可以在球队这边报名。",
      confirmText: "确认带队",
      confirmIcon: "check",
      cancelIcon: "undo",
    });
    if (confirmed) await run(() => claimVenueSide(matchId, teamId), "已带队报名");
  }

  async function handleReleaseSide(side: VenueSideCard) {
    const matchId = sourceMatch.value?.id;
    if (!matchId || !side.releaseAction) return;
    const removing = side.releaseAction === "remove";
    const confirmed = await confirm({
      title: removing ? "移出球队" : "退出比赛",
      content: removing
        ? `确认把${side.title}移出？这一边会重新开放，该队队员的报名失效，并收到通知。`
        : "确认带队退出？这一边会重新开放，队员的报名失效。",
      highlight: removing ? side.title : undefined,
      confirmText: removing ? "确认移出" : "确认退出",
      confirmIcon: "close",
      cancelIcon: "undo",
      danger: true,
    });
    if (!confirmed) return;
    await run(
      () => (removing ? removeVenueSide(matchId, side.groupId) : withdrawVenueSide(matchId, side.groupId)),
      removing ? "已移出球队" : "已退出",
    );
  }

  return { isVenueMatch, venueSideCards, canClaimSide, venueSideBusy, handleClaimSide, handleReleaseSide };
}
