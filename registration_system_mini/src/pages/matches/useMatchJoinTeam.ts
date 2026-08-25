import { computed, ref, type ComputedRef } from "vue";
import { checkTeamRequiresPassword, joinTeamFromForm } from "@/pages/teams/teamSelfActions";
import { useTeamContext } from "@/stores/teamContext";

export interface MatchJoinTeamTarget {
  id: number;
  name: string;
}

/**
 * 比赛详情页「加入球队后可报名」弹框：
 * 确认加入 →（需要时）输入入队密码 → 加入成功刷新会话；无密码场景可直接联系队长。
 */
export function useMatchJoinTeam(target: ComputedRef<MatchJoinTeamTarget | null>) {
  const { refreshSessionContext } = useTeamContext();

  const sheetVisible = ref(false);
  const needsPassword = ref(false);
  const password = ref("");
  const isSubmitting = ref(false);
  const teamName = computed(() => target.value?.name ?? "");

  function open() {
    if (!target.value) {
      // 理论上不会发生（该入口只在有主队的比赛出现）；兜底走完整加入页。
      uni.navigateTo({ url: "/pages/teams/join/index" });
      return;
    }
    needsPassword.value = false;
    password.value = "";
    sheetVisible.value = true;
  }

  function close() {
    if (isSubmitting.value) return;
    sheetVisible.value = false;
  }

  function requestContactCaptain() {
    if (isSubmitting.value) return;
    sheetVisible.value = false;
  }

  async function confirmJoin() {
    const team = target.value;
    if (!team || isSubmitting.value) return;
    isSubmitting.value = true;
    try {
      if (!needsPassword.value) {
        // 首次确认先查密码要求：需要密码时切换到密码输入视图，不发起加入。
        needsPassword.value = await checkTeamRequiresPassword(team.id);
        if (needsPassword.value) {
          return;
        }
      }
      await joinTeamFromForm({ teamId: team.id, password: password.value.trim() || undefined });
      await refreshSessionContext();
      sheetVisible.value = false;
      uni.$emit("home:data-may-changed");
      uni.showToast({ title: `已加入${team.name}，现在可以报名了`, icon: "none" });
    } catch (error) {
      uni.showToast({ title: error instanceof Error ? error.message : "加入球队失败", icon: "none" });
    } finally {
      isSubmitting.value = false;
    }
  }

  return { sheetVisible, needsPassword, password, isSubmitting, teamName, open, close, requestContactCaptain, confirmJoin };
}
