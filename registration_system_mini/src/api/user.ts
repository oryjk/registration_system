import type {
  BackendApiResponse,
  BackendAvatarUploadResult,
  BackendAttendanceRankingItem,
  BackendUser,
  BackendUserActivityRecord,
  BackendUserAttendanceRecord,
  BackendUserLoginResponse,
} from "@/types/backend";
import { getApiBaseUrl } from "@/config/apiBase";
import { getAccessToken } from "@/utils/authStorage";
import { buildQueryString } from "@/utils/queryString";
import { ApiRequestError, requestApi } from "@/utils/request";

export function loginWithOpenId(payload: {
  open_id: string;
  union_id?: string | null;
  username?: string;
  nickname?: string;
  avatar_url?: string;
}) {
  return requestApi<BackendUserLoginResponse>({
    url: "/user/login",
    method: "POST",
    data: payload,
  });
}

export function getCurrentUser() {
  return requestApi<BackendUser>({
    url: "/user/info",
    auth: true,
  });
}

export function updateMyProfile(payload: {
  nickname?: string;
  real_name?: string;
  avatar_url?: string;
}) {
  return requestApi<BackendUser>({
    url: "/user/info",
    method: "PATCH",
    data: payload,
    auth: true,
  });
}

export function bindMyPhoneNumber(payload: { phone_number: string }) {
  return requestApi<BackendUser>({
    url: "/user/phone",
    method: "PATCH",
    data: payload,
    auth: true,
  });
}

export async function uploadMyAvatar(filePath: string) {
  const token = getAccessToken();

  return new Promise<BackendAvatarUploadResult>((resolve, reject) => {
    uni.uploadFile({
      url: `${getApiBaseUrl()}/user/avatar`,
      filePath,
      name: "file",
      header: token ? { Authorization: `Bearer ${token}` } : {},
      success: (response) => {
        let parsed: BackendApiResponse<BackendAvatarUploadResult> | null = null;
        try {
          parsed = JSON.parse(response.data) as BackendApiResponse<BackendAvatarUploadResult>;
        } catch (error) {
          reject(new ApiRequestError("头像上传响应解析失败"));
          return;
        }

        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new ApiRequestError(parsed?.message || "头像上传失败", response.statusCode));
          return;
        }

        if (!parsed?.success || !parsed.data) {
          reject(new ApiRequestError(parsed?.message || "头像上传失败", response.statusCode));
          return;
        }

        resolve(parsed.data);
      },
      fail: (error) => {
        reject(new ApiRequestError(error.errMsg || "头像上传失败"));
      },
    });
  });
}

export function getMyActivities() {
  return requestApi<BackendUserActivityRecord[]>({
    url: "/user/activities",
    auth: true,
  });
}

export function getMyAttendance(params?: {
  startDate?: string;
  endDate?: string;
}) {
  const queryString = buildQueryString({
    startDate: params?.startDate,
    endDate: params?.endDate,
  });

  return requestApi<BackendUserAttendanceRecord[]>({
    url: `/user/attendance${queryString ? `?${queryString}` : ""}`,
    auth: true,
  });
}

export function getAttendanceRanking() {
  return requestApi<BackendAttendanceRankingItem[]>({
    url: "/user/attendance-ranking",
    auth: true,
  });
}

export function listUsers() {
  return requestApi<BackendUser[]>({
    url: "/user/infos",
  });
}

export function searchUsers(keyword: string, limit = 8) {
  const queryString = buildQueryString({ keyword, limit });
  return requestApi<BackendUser[]>({
    url: `/user/search${queryString ? `?${queryString}` : ""}`,
    auth: true,
  });
}
