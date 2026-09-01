import { ref } from "vue";
import { useTeamContext } from "@/stores/teamContext";
import { needsProfileCompletion } from "@/utils/profileCompletion";

// 加入球队前的资料门槛：昵称/头像缺失时弹出 ProfileCompletionDialog，
// 用户保存成功后才放行后续加入流程；用户放弃则中止加入。
export function useProfileCompletionGate() {
  const { currentUser } = useTeamContext();
  const profileGateVisible = ref(false);
  let resolver: ((completed: boolean) => void) | null = null;

  function ensureProfileComplete(): Promise<boolean> {
    if (!needsProfileCompletion(currentUser.value)) {
      return Promise.resolve(true);
    }
    profileGateVisible.value = true;
    return new Promise<boolean>((resolve) => {
      resolver = resolve;
    });
  }

  function settle(completed: boolean) {
    profileGateVisible.value = false;
    resolver?.(completed);
    resolver = null;
  }

  function handleProfileGateCompleted() {
    settle(true);
  }

  function handleProfileGateCancel() {
    settle(false);
  }

  return {
    profileGateVisible,
    ensureProfileComplete,
    handleProfileGateCompleted,
    handleProfileGateCancel,
  };
}
