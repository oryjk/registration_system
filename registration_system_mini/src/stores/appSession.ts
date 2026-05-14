import { computed, ref } from "vue";
import { getMyTeams, getTeamDetail } from "@/api/team";
import { getCurrentUser, loginWithOpenId } from "@/api/user";
import { wxLogin } from "@/api/wx";
import type { BackendTeam, BackendTeamDetail, BackendUser } from "@/types/backend";
import type { TeamProfileViewModel } from "@/types/viewModels";
import { resolveSessionBootstrapMode } from "@/stores/bootstrapStrategy";
import {
  clearAccessToken,
  clearManualLogout,
  clearCurrentTeamId,
  getAccessToken,
  getCurrentTeamId,
  hasManualLogout,
  setManualLogout,
  setAccessToken,
  setCurrentTeamId,
} from "@/utils/authStorage";
import { buildTeamProfiles } from "@/utils/viewModels";
import { isUnauthorizedError } from "@/utils/request";

const currentUser = ref<BackendUser | null>(null);
const myTeams = ref<BackendTeam[]>([]);
const teamDetailsById = ref<Record<number, BackendTeamDetail>>({});
const currentTeamId = ref(getCurrentTeamId());
const bootstrapError = ref("");
const isBootstrapping = ref(false);

let bootstrapPromise: Promise<void> | null = null;

const teamProfiles = computed<TeamProfileViewModel[]>(() =>
  currentUser.value ? buildTeamProfiles(currentUser.value.id, myTeams.value, teamDetailsById.value) : [],
);

const currentTeam = computed<TeamProfileViewModel | null>(() => {
  if (!teamProfiles.value.length) {
    return null;
  }

  return teamProfiles.value.find((item) => item.id === currentTeamId.value) ?? teamProfiles.value[0];
});

function persistCurrentTeam(teamId: number) {
  currentTeamId.value = teamId;
  setCurrentTeamId(teamId);
}

function selectAvailableTeam() {
  if (!teamProfiles.value.length) {
    currentTeamId.value = null;
    clearCurrentTeamId();
    return;
  }

  const storedTeamId = getCurrentTeamId();
  const matchedTeam = teamProfiles.value.find((item) => item.id === storedTeamId) ?? teamProfiles.value[0];
  persistCurrentTeam(matchedTeam.id);
}

function resetSessionState() {
  currentUser.value = null;
  myTeams.value = [];
  teamDetailsById.value = {};
  currentTeamId.value = null;
  bootstrapError.value = "";
}

function requestWechatCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.login({
      provider: "weixin",
      success: (result) => {
        if (!result.code) {
          reject(new Error("微信登录未返回 code"));
          return;
        }
        resolve(result.code);
      },
      fail: (error) => {
        reject(new Error(error.errMsg || "微信登录失败"));
      },
    });
  });
}

async function loadTeamContext() {
  const teams = await getMyTeams();
  const detailEntries = await Promise.all(
    teams.map(async (team) => [team.id, await getTeamDetail(team.id)] as const),
  );

  myTeams.value = teams;
  teamDetailsById.value = Object.fromEntries(detailEntries);
  selectAvailableTeam();
}

async function loginAndBootstrap() {
  const code = await requestWechatCode();
  const wxSession = await wxLogin(code);
  const loginResult = await loginWithOpenId({
    open_id: wxSession.openid,
    union_id: wxSession.unionid ?? undefined,
  });

  setAccessToken(loginResult.access_token);
  currentUser.value = loginResult.user;
  await loadTeamContext();
}

async function bootstrapFromExistingToken() {
  currentUser.value = await getCurrentUser();
  await loadTeamContext();
}

export async function ensureSessionReady(force = false) {
  if (bootstrapPromise && !force) {
    return bootstrapPromise;
  }

  bootstrapPromise = (async () => {
    isBootstrapping.value = true;
    bootstrapError.value = "";

    try {
      const bootstrapMode = resolveSessionBootstrapMode({
        hasAccessToken: !!getAccessToken(),
        isManuallyLoggedOut: hasManualLogout(),
        force,
      });

      if (bootstrapMode === "blocked_by_logout") {
        resetSessionState();
        throw new Error("已退出登录，请点击顶部卡片重新登录");
      }

      if (bootstrapMode === "existing_token") {
        try {
          await bootstrapFromExistingToken();
          return;
        } catch (error) {
          if (!isUnauthorizedError(error)) {
            throw error;
          }
          clearAccessToken();
        }
      }

      await loginAndBootstrap();
    } catch (error) {
      resetSessionState();
      bootstrapError.value = error instanceof Error ? error.message : "会话初始化失败";
      throw error;
    } finally {
      isBootstrapping.value = false;
      bootstrapPromise = null;
    }
  })();

  return bootstrapPromise;
}

export async function refreshSessionContext() {
  await ensureSessionReady(true);
}

export function clearSession() {
  clearAccessToken();
  clearCurrentTeamId();
  setManualLogout();
  resetSessionState();
}

export function resumeSessionBootstrap() {
  clearManualLogout();
}

export function useAppSession() {
  function switchTeam(teamId: number) {
    if (!teamProfiles.value.some((item) => item.id === teamId)) {
      return;
    }

    persistCurrentTeam(teamId);
  }

  return {
    currentUser,
    myTeams,
    teamProfiles,
    currentTeamId,
    currentTeam,
    teamDetailsById,
    bootstrapError,
    isBootstrapping,
    switchTeam,
    ensureSessionReady,
    refreshSessionContext,
  };
}
