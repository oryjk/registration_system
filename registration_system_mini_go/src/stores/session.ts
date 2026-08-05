import { computed, ref } from "vue";
import { loginWithWechatCode } from "@/api/auth";
import { getMyTeams } from "@/api/team";
import { isUnauthorized } from "@/api/http";
import type { TeamMembership, User } from "@/types/api";
import { clearStoredSession, getAccessToken, getStoredUser, saveSession } from "@/utils/storage";

const currentUser = ref<User | null>(getStoredUser());
const teams = ref<TeamMembership[]>([]);
const loading = ref(false);
const errorMessage = ref("");

const isLoggedIn = computed(() => Boolean(getAccessToken() && currentUser.value));

function requestWechatCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    // #ifdef H5
    reject(new Error("请在微信小程序中完成登录"));
    // #endif

    // #ifdef MP-WEIXIN
    uni.login({
      provider: "weixin",
      success: (result) => (result.code ? resolve(result.code) : reject(new Error("微信未返回登录凭证"))),
      fail: (error) => reject(new Error(error.errMsg || "微信登录失败")),
    });
    // #endif
  });
}

async function loadTeams() {
  teams.value = await getMyTeams();
}

export async function login() {
  loading.value = true;
  errorMessage.value = "";
  try {
    const code = await requestWechatCode();
    const result = await loginWithWechatCode(code);
    saveSession(result.token, result.user);
    currentUser.value = result.user;
    try {
      await loadTeams();
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "球队加载失败";
    }
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "登录失败";
    throw error;
  } finally {
    loading.value = false;
  }
}

export async function restoreSession() {
  if (!getAccessToken() || !currentUser.value) return;
  loading.value = true;
  try {
    await loadTeams();
  } catch (error) {
    if (isUnauthorized(error)) {
      logout();
      return;
    }
    errorMessage.value = error instanceof Error ? error.message : "球队加载失败";
  } finally {
    loading.value = false;
  }
}

export async function refreshTeams() {
  if (!isLoggedIn.value) return;
  loading.value = true;
  errorMessage.value = "";
  try {
    await loadTeams();
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "球队加载失败";
  } finally {
    loading.value = false;
  }
}

export function logout() {
  clearStoredSession();
  currentUser.value = null;
  teams.value = [];
  errorMessage.value = "";
}

export function useSession() {
  return { currentUser, teams, loading, errorMessage, isLoggedIn, login, logout, refreshTeams };
}
