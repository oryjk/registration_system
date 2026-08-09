import { computed, ref } from "vue";
import { listTestLoginUsers, testLogin, wechatLogin } from "@/api/auth";
import { getMyTeams, getTeamDetail } from "@/api/team";
import { getCurrentUser, toLegacyUser } from "@/api/user";
import { isMockEnabled } from "@/mock";
import type { BackendTeam, BackendTeamDetail, BackendUser } from "@/types/backend";
import type { TeamProfileViewModel } from "@/types/viewModels";
import { resolveSessionBootstrapMode, resolveStoredSessionStrategy } from "@/stores/bootstrapStrategy";
import { buildAvailableIdentities, findCurrentIdentity, resolveCurrentIdentitySelection } from "@/stores/currentIdentity";
import {
  clearCurrentIdentitySelection,
  clearLocalSessionStorage,
  clearManualLogout,
  clearCurrentTeamId,
  clearAccessToken,
  getAccessToken,
  getCurrentIdentitySelection,
  getCurrentTeamId,
  hasManualLogout,
  setManualLogout,
  setAccessToken,
  setCurrentIdentitySelection,
  setCurrentTeamId,
  type StoredCurrentIdentitySelection,
} from "@/utils/authStorage";
import { buildTeamProfiles } from "@/utils/viewModels";
import { isUnauthorizedError } from "@/utils/request";

const currentUser = ref<BackendUser | null>(null);
const myTeams = ref<BackendTeam[]>([]);
const teamDetailsById = ref<Record<number, BackendTeamDetail>>({});
const currentTeamId = ref(getCurrentTeamId());
const currentIdentitySelection = ref<StoredCurrentIdentitySelection | null>(getCurrentIdentitySelection());
const bootstrapError = ref("");
const isBootstrapping = ref(false);

let bootstrapPromise: Promise<void> | null = null;
let sessionVersion = 0;

const teamProfiles = computed<TeamProfileViewModel[]>(() =>
  currentUser.value ? buildTeamProfiles(currentUser.value.id, myTeams.value, teamDetailsById.value) : [],
);

const currentTeam = computed<TeamProfileViewModel | null>(() => {
  if (!teamProfiles.value.length) {
    return null;
  }

  return teamProfiles.value.find((item) => item.id === currentTeamId.value) ?? teamProfiles.value[0];
});

const availableIdentities = computed(() => buildAvailableIdentities(currentUser.value, teamProfiles.value));
const currentIdentity = computed(() => findCurrentIdentity(currentIdentitySelection.value, availableIdentities.value));

function persistCurrentTeam(teamId: number) {
  currentTeamId.value = teamId;
  setCurrentTeamId(teamId);
}

function persistCurrentIdentity(selection: StoredCurrentIdentitySelection | null) {
  currentIdentitySelection.value = selection;
  if (selection) {
    setCurrentIdentitySelection(selection);
  } else {
    clearCurrentIdentitySelection();
  }
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

function selectAvailableIdentity() {
  const selection = resolveCurrentIdentitySelection(
    getCurrentIdentitySelection(),
    availableIdentities.value,
    currentTeamId.value,
  );
  persistCurrentIdentity(selection);
}

function resetSessionState() {
  currentUser.value = null;
  myTeams.value = [];
  teamDetailsById.value = {};
  currentTeamId.value = null;
  currentIdentitySelection.value = null;
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

  myTeams.value = teams;
  selectAvailableTeam();
  selectAvailableIdentity();
}

async function ensureTeamDetailLoaded(teamId: number) {
  if (teamDetailsById.value[teamId]) {
    return teamDetailsById.value[teamId];
  }

  const detail = await getTeamDetail(teamId);
  teamDetailsById.value = {
    ...teamDetailsById.value,
    [teamId]: detail,
  };
  return detail;
}

function assertSessionVersion(version: number) {
  if (version !== sessionVersion || hasManualLogout()) {
    clearLocalSessionStorage();
    resetSessionState();
    throw new Error("已退出登录，请点击顶部卡片重新登录");
  }
}

/**
 * Mock 模式专用 bootstrap：跳过微信登录，直接写入 mock token，
 * 然后通过（已被 mock 拦截的）API 调用建立用户和球队上下文。
 */
async function bootstrapMockSession() {
  clearManualLogout();
  setAccessToken("mock-token");
  currentUser.value = await getCurrentUser();
  await loadTeamContext();
}

async function loginAndBootstrap(sessionBootstrapVersion: number) {
  const code = await requestWechatCode();
  assertSessionVersion(sessionBootstrapVersion);
  const loginResult = await wechatLogin(code);
  assertSessionVersion(sessionBootstrapVersion);

  setAccessToken(loginResult.token);
  assertSessionVersion(sessionBootstrapVersion);
  currentUser.value = toLegacyUser(loginResult.user);
  await loadTeamContext();
  assertSessionVersion(sessionBootstrapVersion);
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
    if (force && hasManualLogout()) {
      sessionVersion += 1;
      clearManualLogout();
    }

    const sessionBootstrapVersion = sessionVersion;
    isBootstrapping.value = true;
    bootstrapError.value = "";

    try {
      // Mock 模式：跳过微信登录，直接用 mock 数据建立会话
      if (isMockEnabled()) {
        await bootstrapMockSession();
        return;
      }

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

      await loginAndBootstrap(sessionBootstrapVersion);
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
  // #ifdef H5
  if (import.meta.env.MODE !== "production" && import.meta.env.VITE_ENABLE_H5_TEST_LOGIN === "true") {
    const result = await listTestLoginUsers();
    const defaultUserId = result.items.some((user) => user.id === result.default_user_id)
      ? result.default_user_id
      : result.items[0]?.id;
    if (!defaultUserId) {
      throw new Error("Go 后端没有可用的 H5 测试用户");
    }
    await loginWithTestUser(defaultUserId);
    return;
  }
  // #endif

  await ensureSessionReady(true);
}

export async function loginWithTestUser(userId: number) {
  const loginVersion = ++sessionVersion;
  clearManualLogout();
  isBootstrapping.value = true;
  bootstrapError.value = "";

  try {
    const loginResult = await testLogin(userId);
    assertSessionVersion(loginVersion);
    setAccessToken(loginResult.token);
    currentUser.value = toLegacyUser(loginResult.user);
    await loadTeamContext();
    assertSessionVersion(loginVersion);
  } catch (error) {
    resetSessionState();
    bootstrapError.value = error instanceof Error ? error.message : "测试用户登录失败";
    throw error;
  } finally {
    isBootstrapping.value = false;
  }
}

export async function restoreSessionFromStorage() {
  if (bootstrapPromise) {
    return bootstrapPromise;
  }

  // Mock 模式：跳过微信登录，直接建立 mock 会话
  if (isMockEnabled()) {
    bootstrapPromise = bootstrapMockSession().finally(() => {
      bootstrapPromise = null;
    });
    return bootstrapPromise;
  }

  const strategy = resolveStoredSessionStrategy({
    hasAccessToken: !!getAccessToken(),
    isManuallyLoggedOut: hasManualLogout(),
  });

  if (strategy === "guest") {
    if (hasManualLogout()) {
      clearLocalSessionStorage();
    }
    resetSessionState();
    return;
  }

  bootstrapPromise = (async () => {
    try {
      await bootstrapFromExistingToken();
    } catch (error) {
      if (!isUnauthorizedError(error)) {
        throw error;
      }
      clearAccessToken();
      resetSessionState();
    } finally {
      bootstrapPromise = null;
    }
  })();

  return bootstrapPromise;
}

export function clearSession() {
  sessionVersion += 1;
  clearLocalSessionStorage();
  setManualLogout();
  resetSessionState();
}

export function resumeSessionBootstrap() {
  sessionVersion += 1;
  clearManualLogout();
}

export function useAppSession() {
  function switchTeam(teamId: number) {
    if (!teamProfiles.value.some((item) => item.id === teamId)) {
      return;
    }

    const shouldFollowTeamIdentity = currentIdentitySelection.value?.kind === "team";
    persistCurrentTeam(teamId);
    if (shouldFollowTeamIdentity && teamProfiles.value.some((item) => item.id === teamId && item.canManageTeam)) {
      persistCurrentIdentity({ kind: "team", teamId });
      return;
    }

    selectAvailableIdentity();
  }

  function switchIdentity(identityId: string) {
    const identity = availableIdentities.value.find((item) => item.id === identityId);
    if (!identity) {
      return;
    }

    persistCurrentIdentity(identity.kind === "team" ? { kind: "team", teamId: identity.teamId } : { kind: "venue" });
  }

  return {
    currentUser,
    myTeams,
    teamProfiles,
    currentTeamId,
    currentTeam,
    availableIdentities,
    currentIdentity,
    teamDetailsById,
    ensureTeamDetailLoaded,
    bootstrapError,
    isBootstrapping,
    switchTeam,
    switchIdentity,
    ensureSessionReady,
    refreshSessionContext,
    loginWithTestUser,
    restoreSessionFromStorage,
  };
}
