import type {
  BackendApiResponse,
  BackendAvatarUploadResult,
  BackendAttendanceRankingItem,
  BackendUser,
  BackendUserActivityRecord,
  BackendUserAttendanceRecord,
} from "@/types/backend";
import type { AppUser } from "@/types/app";
import { getApiBaseUrl } from "@/config/apiBase";
import { getAccessToken } from "@/utils/authStorage";
import type { DateRangeParams } from "@/utils/dateRange";
import { buildQueryString } from "@/utils/queryString";
import { ApiRequestError, requestApi } from "@/utils/request";

export function getMe() {
  return requestApi<AppUser>({
    url: "/users/me",
    auth: true,
  });
}

export function toBackendUser(user: AppUser): BackendUser {
  return {
    id: user.id,
    open_id: "",
    username: "",
    nickname: user.nickname,
    real_name: user.real_name ?? "",
    avatar_url: user.avatar_url ?? "",
    phone_number: user.phone_number ?? "",
    is_manager: false,
    is_venue: false,
  };
}

/** 页面展示层暂时沿用旧模型，协议切换集中在 API 适配层。 */
export async function getCurrentUser() {
  return toBackendUser(await getMe());
}

export function updateMyProfile(payload: {
  nickname?: string;
  real_name?: string;
  avatar_url?: string;
}) {
  // 注意：当前版本不上传 avatar_url（后端 PATCH /users/me 已支持），
  // 头像由 uploadMyAvatar 接口直接回写；下个版本再随路径切换一起带上。
  return requestApi<AppUser>({
    url: "/users/me",
    method: "PATCH",
    data: {
      nickname: payload.nickname,
      real_name: payload.real_name,
    },
    auth: true,
  }).then(toBackendUser);
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
      // 已发布版本沿用旧路径 /user/avatar（Go 后端提供兼容路由）；
      // 下个版本切换到 /users/me/avatar。
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

        if (parsed?.code !== 0 || !parsed.data) {
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

export function getMyAttendance(params?: DateRangeParams) {
  const queryString = buildQueryString({
    startDate: params?.startDate,
    endDate: params?.endDate,
  });

  return requestApi<BackendUserAttendanceRecord[]>({
    url: `/user/attendance${queryString ? `?${queryString}` : ""}`,
    auth: true,
  });
}

export function getAttendanceRanking(params?: DateRangeParams) {
  const queryString = buildQueryString({
    startDate: params?.startDate,
    endDate: params?.endDate,
  });

  return requestApi<BackendAttendanceRankingItem[]>({
    url: `/user/attendance-ranking${queryString ? `?${queryString}` : ""}`,
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
