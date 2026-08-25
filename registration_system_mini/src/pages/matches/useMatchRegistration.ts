import type { ComputedRef, Ref } from "vue";
import {
  cancelIndividualRegistration,
  cancelMatchIndividualRegistration,
  cancelTeamRegistrationForMatch,
  submitIndividualLeave,
  submitIndividualRegistration,
  submitMatchIndividualRegistration,
  submitTeamRegistrationForMatch,
} from "./detailActions";
import type { BackendActivity, BackendRegistration, BackendUser } from "@/types/backend";
import type { TeamProfileViewModel } from "@/types/viewModels";
import type { NeoConfirmDialogOptions } from "@/components/neo";
import { toStandLabel } from "@/utils/viewModels";
import { applyIndividualRegistrationPatch, clampTeamRegistrationCount } from "./detailState";
import type { RegistrationWindowState } from "@/utils/registrationWindow";

interface MatchRegistrationDependencies {
  match: Ref<BackendActivity | null>;
  registrations: Ref<BackendRegistration[]>;
  currentStatus: Ref<string>;  currentUser: Ref<BackendUser | null>;
  currentTeam: ComputedRef<TeamProfileViewModel | null>;
  submittingStatus: Ref<boolean>;
  isGuestMode: Ref<boolean>;
  isMatchApiDetail: Ref<boolean>;
  registrationGroupId: Ref<string>;
  /** 纯球队组比赛且用户未加入任何球队：报名入口引导跳转加入球队。 */
  needsTeamToRegister: ComputedRef<boolean>;
  canSubmitIndividualRegistration: ComputedRef<boolean>;
  registrationWindowState: ComputedRef<RegistrationWindowState>;
  canUseTeamRegistration: ComputedRef<boolean>;
  existingTeamDerivedActivity: Ref<BackendActivity | null>;
  sourceTeamRegistrationCount: Ref<number>;
  teamRegistrationCount: Ref<number>;
  ensureSessionReady: () => Promise<void>;
  handleGuestLogin: () => Promise<void>;
  confirmRegistrationAction: (options: NeoConfirmDialogOptions) => Promise<boolean>;
  /** 赛前支付且有人均费用时，报名成功后立即发起支付。 */
  requiresPrepaidPayment: ComputedRef<boolean>;
  payRegistrationFee: () => Promise<boolean>;
  /** 散人约球（online_pickup）：报名入口改为人数选择面板。 */
  isPickupMatch: ComputedRef<boolean>;
  /** 报名费已支付：报名人数与取消入口锁定。 */
  myRegistrationPaid: Ref<boolean>;
  /** 打开报名人数面板（由页面持有面板可见状态）。 */
  openSignupSheet: () => void;
  /** 关闭报名人数面板（提交/取消成功后由页面收起）。 */
  closeSignupSheet: () => void;
}

export function useMatchRegistration(dependencies: MatchRegistrationDependencies) {
  const {
    match,
    registrations,
    currentStatus,
    currentUser,
    currentTeam,
    submittingStatus,
    isGuestMode,
    isMatchApiDetail,
    registrationGroupId,
    needsTeamToRegister,
    canSubmitIndividualRegistration,
    registrationWindowState,
    canUseTeamRegistration,
    existingTeamDerivedActivity,
    sourceTeamRegistrationCount,
    teamRegistrationCount,
    ensureSessionReady,
    handleGuestLogin,
    confirmRegistrationAction,
    requiresPrepaidPayment,
    payRegistrationFee,
    isPickupMatch,
    myRegistrationPaid,
    openSignupSheet,
    closeSignupSheet,
  } = dependencies;

  function ensureRegistrationOpen() {
    if (registrationWindowState.value === "open") return true;
    uni.showToast({
      title: registrationWindowState.value === "not_started" ? "报名尚未开始" : "报名已结束",
      icon: "none",
    });
    return false;
  }

  function applyIndividualRegistrationState(stand: number, registrationCount: number) {
    const userId = currentUser.value?.id;
    if (!userId) return;

    currentStatus.value = toStandLabel(stand);
    registrations.value = applyIndividualRegistrationPatch(registrations.value, userId, stand, registrationCount);
  }

  async function submitIndividualRegistrationStatus(status: "attending" | "leave", registrationCount = 1) {
    if (isMatchApiDetail.value) {
      if (!registrationGroupId.value) throw new Error("未找到可报名分组");
      await submitMatchIndividualRegistration(match.value!.id, registrationGroupId.value, status, registrationCount);
      return;
    }

    if (status === "attending") {
      await submitIndividualRegistration(match.value!.id);
      return;
    }
    await submitIndividualLeave(match.value!.id);
  }

  async function cancelIndividualRegistrationStatus() {
    if (isMatchApiDetail.value) {
      if (!registrationGroupId.value) throw new Error("未找到可报名分组");
      await cancelMatchIndividualRegistration(match.value!.id, registrationGroupId.value);
      return;
    }
    await cancelIndividualRegistration(match.value!.id);
  }

  async function handleSelectIndividualSignup() {
    if (!match.value || submittingStatus.value) return;
    if (!ensureRegistrationOpen()) return;
    if (isGuestMode.value) {
      await handleGuestLogin();
      return;
    }
    // 没有可报名的散人组且未加入任何球队：先去加入球队，再回来报名。
    if (needsTeamToRegister.value) {
      uni.navigateTo({ url: "/pages/teams/join/index" });
      return;
    }
    // 散人约球已支付：人数与取消入口锁定，费用问题线下协商。
    if (isPickupMatch.value && isMatchApiDetail.value && currentStatus.value === "参加" && myRegistrationPaid.value) {
      uni.showToast({ title: "已支付的报名不可修改或取消", icon: "none", duration: 2600 });
      return;
    }
    // 散人约球：报名/调整人数都走人数选择面板（含代朋友报名与费用合计展示）。
    if (isPickupMatch.value && isMatchApiDetail.value) {
      if (currentStatus.value !== "参加" && !canSubmitIndividualRegistration.value) {
        uni.showToast({ title: "报名人数已满", icon: "none" });
        return;
      }
      openSignupSheet();
      return;
    }
    if (currentStatus.value === "参加") {
      await handleCancelIndividualSignup();
      return;
    }
    if (!canSubmitIndividualRegistration.value) {
      uni.showToast({ title: "报名人数已满", icon: "none" });
      return;
    }

    const confirmed = await confirmRegistrationAction({
      title: "确认报名",
      content: `确认报名参加${match.value.name}？`,
      highlight: match.value.name,
      confirmText: "确认报名",
    });
    if (!confirmed) return;

    await submitIndividualSignup(1);
  }

  /** 人数选择面板确认：按所选人数报名（散人约球一人可代多人）。 */
  async function handleSignupSheetConfirm(registrationCount: number) {
    await submitIndividualSignup(registrationCount);
    // 报名成功（含支付被取消保留报名的场景）后收起面板；失败时保留面板便于调整人数。
    if (currentStatus.value === "参加") closeSignupSheet();
  }

  /** 人数选择面板里的「取消报名」：面板自身即确认意图，不再弹二次确认。 */
  async function handleSignupSheetCancelRegistration() {
    await handleCancelIndividualSignup(true);
    if (currentStatus.value !== "参加") closeSignupSheet();
  }

  async function submitIndividualSignup(registrationCount: number) {
    submittingStatus.value = true;
    uni.showLoading({ title: "提交中...", mask: true });
    try {
      await ensureSessionReady();
      await submitIndividualRegistrationStatus("attending", registrationCount);
      applyIndividualRegistrationState(1, registrationCount);
      uni.$emit("home:data-may-changed");
      if (requiresPrepaidPayment.value) {
        // 赛前支付：确认报名后立即拉起支付；取消/失败时报名保留，详情页可继续支付。
        await payRegistrationFee();
        return;
      }
      uni.showToast({ title: "报名成功", icon: "none" });
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "报名失败", icon: "none" });
    } finally {
      uni.hideLoading();
      submittingStatus.value = false;
    }
  }

  async function handleCancelIndividualSignup(skipConfirm = false) {
    if (!match.value || submittingStatus.value) return;
  if (!ensureRegistrationOpen()) return;

    if (!skipConfirm) {
      const confirmed = await confirmRegistrationAction({
        title: "确认取消报名",
        content: `确认取消${match.value.name}的报名？取消后可重新报名。`,
        highlight: match.value.name,
        confirmText: "取消报名",
        danger: true,
      });
      if (!confirmed) return;
    }

    submittingStatus.value = true;
    uni.showLoading({ title: "提交中...", mask: true });
    try {
      await ensureSessionReady();
      await cancelIndividualRegistrationStatus();
      applyIndividualRegistrationState(0, 0);
      uni.$emit("home:data-may-changed");
      uni.showToast({ title: "已取消报名", icon: "none" });
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "取消报名失败", icon: "none" });
    } finally {
      uni.hideLoading();
      submittingStatus.value = false;
    }
  }

  async function handleSelectTeamMemberStand(stand: 0 | 1 | 2) {
    if (!match.value || submittingStatus.value) return;
  if (!ensureRegistrationOpen()) return;
    if (isGuestMode.value) {
      await handleGuestLogin();
      return;
    }

    const nextLabel = stand === 1 ? "报名" : stand === 2 ? "请假" : "设为未报名";
    if (stand === 1 && !canSubmitIndividualRegistration.value) {
      uni.showToast({ title: "报名人数已满", icon: "none" });
      return;
    }

    submittingStatus.value = true;
    uni.showLoading({ title: "提交中...", mask: true });
    try {
      await ensureSessionReady();
      if (stand === 1) {
        await submitIndividualRegistrationStatus("attending");
        applyIndividualRegistrationState(1, 1);
      } else if (stand === 2) {
        await submitIndividualRegistrationStatus("leave");
        applyIndividualRegistrationState(2, 0);
      } else {
        await cancelIndividualRegistrationStatus();
        applyIndividualRegistrationState(0, 0);
      }
      uni.$emit("home:data-may-changed");
      uni.showToast({
        title: stand === 1 ? "报名成功" : stand === 2 ? "已请假" : "已设为未报名",
        icon: "none",
      });
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : `${nextLabel}失败`, icon: "none" });
    } finally {
      uni.hideLoading();
      submittingStatus.value = false;
    }
  }

  async function handleTeamSubmit() {
    if (!match.value || submittingStatus.value) return;
  if (!ensureRegistrationOpen()) return;
    if (!canUseTeamRegistration.value || !currentTeam.value) {
      uni.showToast({ title: "仅队长或领队可发起球队报名", icon: "none", duration: 2800 });
      return;
    }

    const registrationCount = clampTeamRegistrationCount(Number(teamRegistrationCount.value));
    teamRegistrationCount.value = registrationCount;
    submittingStatus.value = true;
    try {
      if (existingTeamDerivedActivity.value) {
        const confirmed = await confirmRegistrationAction({
          title: "取消球队报名",
          content: "确认取消当前球队报名？对应的队内报名也会关闭。",
          confirmText: "取消报名",
          danger: true,
        });
        if (!confirmed) return;

        await cancelTeamRegistrationForMatch(match.value.id, currentTeam.value.id);
        sourceTeamRegistrationCount.value = Math.max(
          sourceTeamRegistrationCount.value - Number(existingTeamDerivedActivity.value.team_registration_count ?? 0),
          0,
        );
        existingTeamDerivedActivity.value = null;
        uni.$emit("home:data-may-changed");
        uni.showToast({ title: "球队报名已取消", icon: "none" });
        return;
      }

      const derivedActivity = await submitTeamRegistrationForMatch(match.value.id, currentTeam.value.id, registrationCount);
      existingTeamDerivedActivity.value = derivedActivity;
      uni.$emit("home:data-may-changed");
      uni.showToast({ title: "球队报名已发起", icon: "none" });
      if (derivedActivity.id && derivedActivity.id !== match.value.id) {
        setTimeout(() => {
          uni.redirectTo({ url: `/pages/matches/detail?id=${derivedActivity.id}` });
        }, 500);
      }
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "球队报名失败", icon: "none" });
    } finally {
      submittingStatus.value = false;
    }
  }

  return {
    handleSelectIndividualSignup,
    handleSignupSheetConfirm,
    handleSignupSheetCancelRegistration,
    handleSelectTeamMemberStand,
    handleTeamSubmit,
  };
}
