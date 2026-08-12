import type { ComputedRef, Ref } from "vue";
import {
  cancelIndividualRegistration,
  cancelGoIndividualRegistration,
  cancelTeamRegistrationForMatch,
  submitIndividualLeave,
  submitIndividualRegistration,
  submitGoIndividualRegistration,
  submitTeamRegistrationForMatch,
} from "./detailActions";
import type { BackendActivity, BackendRegistration, BackendUser } from "@/types/backend";
import type { TeamProfileViewModel } from "@/types/viewModels";
import { toStandLabel } from "@/utils/viewModels";
import { applyIndividualRegistrationPatch, clampTeamRegistrationCount } from "./detailState";

interface MatchRegistrationDependencies {
  match: Ref<BackendActivity | null>;
  registrations: Ref<BackendRegistration[]>;
  currentStatus: Ref<string>;
  currentUser: Ref<BackendUser | null>;
  currentTeam: ComputedRef<TeamProfileViewModel | null>;
  submittingStatus: Ref<boolean>;
  isGuestMode: Ref<boolean>;
  isGoMatchDetail: Ref<boolean>;
  goRegistrationGroupId: Ref<string>;
  canSubmitIndividualRegistration: ComputedRef<boolean>;
  canUseTeamRegistration: ComputedRef<boolean>;
  existingTeamDerivedActivity: Ref<BackendActivity | null>;
  sourceTeamRegistrationCount: Ref<number>;
  teamRegistrationCount: Ref<number>;
  ensureSessionReady: () => Promise<void>;
  handleGuestLogin: () => Promise<void>;
  confirmRegistrationAction: (options: { title: string; content: string; confirmText?: string }) => Promise<boolean>;
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
    isGoMatchDetail,
    goRegistrationGroupId,
    canSubmitIndividualRegistration,
    canUseTeamRegistration,
    existingTeamDerivedActivity,
    sourceTeamRegistrationCount,
    teamRegistrationCount,
    ensureSessionReady,
    handleGuestLogin,
    confirmRegistrationAction,
  } = dependencies;

  function applyIndividualRegistrationState(stand: number, registrationCount: number) {
    const userId = currentUser.value?.id;
    if (!userId) return;

    currentStatus.value = toStandLabel(stand);
    registrations.value = applyIndividualRegistrationPatch(registrations.value, userId, stand, registrationCount);
  }

  async function submitIndividualRegistrationStatus(status: "attending" | "leave") {
    if (isGoMatchDetail.value) {
      if (!goRegistrationGroupId.value) throw new Error("未找到可报名分组");
      await submitGoIndividualRegistration(match.value!.id, goRegistrationGroupId.value, status);
      return;
    }

    if (status === "attending") {
      await submitIndividualRegistration(match.value!.id);
      return;
    }
    await submitIndividualLeave(match.value!.id);
  }

  async function cancelIndividualRegistrationStatus() {
    if (isGoMatchDetail.value) {
      if (!goRegistrationGroupId.value) throw new Error("未找到可报名分组");
      await cancelGoIndividualRegistration(match.value!.id, goRegistrationGroupId.value);
      return;
    }
    await cancelIndividualRegistration(match.value!.id);
  }

  async function handleSelectIndividualSignup() {
    if (!match.value || submittingStatus.value) return;
    if (isGuestMode.value) {
      await handleGuestLogin();
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
      content: `确认报名参加「${match.value.name}」？`,
      confirmText: "确认报名",
    });
    if (!confirmed) return;

    submittingStatus.value = true;
    uni.showLoading({ title: "提交中...", mask: true });
    try {
      await ensureSessionReady();
      await submitIndividualRegistrationStatus("attending");
      applyIndividualRegistrationState(1, 1);
      uni.$emit("home:data-may-changed");
      uni.showToast({ title: "报名成功", icon: "none" });
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "报名失败", icon: "none" });
    } finally {
      uni.hideLoading();
      submittingStatus.value = false;
    }
  }

  async function handleCancelIndividualSignup() {
    if (!match.value || submittingStatus.value) return;

    const confirmed = await confirmRegistrationAction({
      title: "确认取消报名",
      content: `确认取消「${match.value.name}」的报名？取消后可重新报名。`,
      confirmText: "取消报名",
    });
    if (!confirmed) return;

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
    handleSelectTeamMemberStand,
    handleTeamSubmit,
  };
}
