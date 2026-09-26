import type { HealthStatus } from "../types/api";
import type {
  MiniAppSettings,
  MiniAppSettingsUpdate,
  OnboardingImageScene,
  ShareImageScene,
} from "../types/system";
import { request } from "./client";

export function getHealth() {
  return request<HealthStatus>("/health", { auth: "none" });
}

export function getMiniAppSettings() {
  return request<MiniAppSettings>("/system/mini-app-settings");
}

export function updateMiniAppSettings(payload: MiniAppSettingsUpdate) {
  return request<MiniAppSettings>("/system/mini-app-settings", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

// 上传首页「下一场还没安排」空状态插画；后端校验格式/大小、写入 MinIO 并自动保存 URL。
export function uploadNextMatchSocialImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return request<MiniAppSettings>(
    "/system/mini-app-settings/home/next-match-social-image",
    { method: "POST", body: formData },
  );
}

// 每次仅更新目标场景，避免覆盖其他图片或开关。
export function clearOnboardingImage(scene: OnboardingImageScene) {
  return updateMiniAppSettings({
    home: { [`onboarding_${scene}_image_url`]: "" },
  });
}

export function uploadOnboardingImage(scene: OnboardingImageScene, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return request<MiniAppSettings>(
    `/system/mini-app-settings/home/onboarding-images/${scene}`,
    { method: "POST", body: formData },
  );
}

export function clearShareImage(scene: ShareImageScene) {
  return updateMiniAppSettings({ home: { [`share_${scene}_image_url`]: "" } });
}

export function uploadShareImage(scene: ShareImageScene, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return request<MiniAppSettings>(
    `/system/mini-app-settings/home/share-images/${scene}`,
    { method: "POST", body: formData },
  );
}
