import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { ErrorAlert } from "@/components/admin/error-alert";
import { ImageLightbox } from "@/components/admin/image-lightbox";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  useMiniAppSettingsQuery,
  useUpdateMiniAppSettingsMutation,
  useUploadNextMatchSocialImageMutation,
} from "@/hooks/queries/useSystemQueries";

export default function SystemSettingsPage() {
  const settings = useMiniAppSettingsQuery();
  const updateSettings = useUpdateMiniAppSettingsMutation();
  const busy = settings.isLoading || updateSettings.isPending;

  const clearProfileEnabled =
    settings.data?.debug.clear_profile_enabled ?? false;
  const reviewToggleEnabled =
    settings.data?.debug.review_status_toggle_enabled ?? false;
  const onboardingEnabled = settings.data?.onboarding.enabled ?? false;
  const nextMatchSocialImageURL =
    settings.data?.home.next_match_social_image_url ?? "";

  return (
    <div className="content-grid">
      <Card>
        <CardHeader>
          <CardTitle>系统设置</CardTitle>
          <CardDescription>小程序运行时配置</CardDescription>
        </CardHeader>
        <CardContent className="settings-stack">
          <section className="setting-row">
            <div className="setting-row-head">
              <Switch
                aria-label="新手引导"
                checked={onboardingEnabled}
                disabled={busy}
                onCheckedChange={(enabled) =>
                  updateSettings.mutate({
                    onboarding: { enabled },
                  })
                }
              />
              <strong>新手引导</strong>
              <span className="cell-secondary">
                {onboardingEnabled ? "已开启" : "已关闭"}
              </span>
            </div>
            <p className="setting-row-description">
              开启后，资料未完善的新用户进入小程序首页时会弹出引导， 选择「队长
              /
              散人」身份后引导完善头像昵称，队长路线继续引导创建球队并提示分享邀请。
              小程序提审期间请保持关闭，过审发布后再开启。
            </p>
          </section>

          <section className="setting-row">
            <div className="setting-row-head">
              <Switch
                aria-label="小程序验证入口"
                checked={clearProfileEnabled}
                disabled={busy}
                onCheckedChange={(enabled) =>
                  updateSettings.mutate({
                    debug: { clear_profile_enabled: enabled },
                  })
                }
              />
              <strong>小程序验证入口</strong>
              <span className="cell-secondary">
                {clearProfileEnabled ? "已开启" : "已关闭"}
              </span>
            </div>
            <p className="setting-row-description">
              开启后，小程序「我的」页会出现「清除头像和昵称」的验证入口，
              用于模拟新用户未完善资料的状态；默认关闭，验证完成后请关闭。
            </p>
          </section>

          <section className="setting-row">
            <div className="setting-row-head">
              <Switch
                aria-label="审核状态切换入口"
                checked={reviewToggleEnabled}
                disabled={busy}
                onCheckedChange={(enabled) =>
                  updateSettings.mutate({
                    debug: { review_status_toggle_enabled: enabled },
                  })
                }
              />
              <strong>审核状态切换入口</strong>
              <span className="cell-secondary">
                {reviewToggleEnabled ? "已开启" : "已关闭"}
              </span>
            </div>
            <p className="setting-row-description">
              开启后，白名单用户（后端 MINI_REVIEW_CONTROL_USER_IDS
              配置）在小程序「我的」页
              可切换当前版本的审核状态，用于提审/过审时的入口显隐验证；默认关闭。
            </p>
          </section>

          <HomeNextMatchSocialImageSection
            savedImageUrl={nextMatchSocialImageURL}
          />

          {settings.isError ? (
            <ErrorAlert
              message="小程序配置加载失败"
              onRetry={() => void settings.refetch()}
            />
          ) : null}
          {updateSettings.isError ? (
            <ErrorAlert message="小程序配置保存失败" />
          ) : null}
          {updateSettings.isSuccess ? (
            <div className="alert alert-success" role="status">
              <div className="alert-body">
                <strong>小程序配置已保存</strong>
                <span>
                  小程序端下次拉取运行配置后生效（进入「我的」页即刷新）。
                </span>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

/** 首页「下一场还没安排」空状态插画：选择/预览/上传，URL 由后端写入运行配置。 */
function HomeNextMatchSocialImageSection({
  savedImageUrl,
}: {
  savedImageUrl: string;
}) {
  const uploadImage = useUploadNextMatchSocialImageMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(
    null,
  );
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const uploading = uploadImage.isPending;
  const previewUrl = selectedPreviewUrl ?? (savedImageUrl || null);

  useEffect(() => {
    return () => {
      if (selectedPreviewUrl) URL.revokeObjectURL(selectedPreviewUrl);
    };
  }, [selectedPreviewUrl]);

  function clearSelectedFile() {
    if (selectedPreviewUrl) URL.revokeObjectURL(selectedPreviewUrl);
    setSelectedFile(null);
    setSelectedPreviewUrl(null);
  }

  function handleSelectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (selectedPreviewUrl) URL.revokeObjectURL(selectedPreviewUrl);
    setSelectedFile(file);
    setSelectedPreviewUrl(URL.createObjectURL(file));
    // 允许连续两次选择同一个文件重新触发 onChange。
    event.target.value = "";
  }

  function handleUpload() {
    if (!selectedFile || uploading) return;
    uploadImage.mutate(selectedFile, {
      onSuccess: clearSelectedFile,
    });
  }

  return (
    <section className="setting-row" aria-label="首页空状态插画">
      <div className="setting-row-head">
        <strong>首页空状态插画</strong>
        <span className="cell-secondary">
          {savedImageUrl ? "已配置" : "未配置"}
        </span>
      </div>
      <p className="setting-row-description">
        用于首页球队管理者没有下一场比赛时，「下一场还没安排」卡片中的
        「下一场还没安排」社交约球插画。 上传后小程序通过运行时配置加载，
        无需重新发布小程序；PNG / JPG / WebP，不超过 2MB。
      </p>

      <div className="flex flex-wrap items-center gap-4">
        {previewUrl ? (
          <button
            type="button"
            className="overflow-hidden rounded-[var(--radius)] border border-border"
            onClick={() => setLightboxOpen(true)}
            aria-label="查看插画大图"
          >
            <img
              alt="首页空状态插画预览"
              className="h-24 w-auto max-w-48 object-contain bg-muted"
              src={previewUrl}
            />
          </button>
        ) : (
          <div className="flex h-24 w-48 items-center justify-center rounded-[var(--radius)] border border-dashed border-border text-sm text-muted">
            暂未上传插画
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            type="file"
            onChange={handleSelectFile}
          />
          <Button
            disabled={uploading}
            type="button"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            选择图片
          </Button>
          <Button
            disabled={!selectedFile || uploading}
            type="button"
            onClick={handleUpload}
          >
            {uploading
              ? "上传中…"
              : savedImageUrl
                ? "上传 / 更换图片"
                : "上传图片"}
          </Button>
          {selectedFile && !uploading ? (
            <Button type="button" variant="ghost" onClick={clearSelectedFile}>
              取消
            </Button>
          ) : null}
        </div>
      </div>

      <ImageLightbox
        caption="首页空状态插画"
        open={lightboxOpen}
        src={previewUrl}
        onOpenChange={setLightboxOpen}
      />

      {uploadImage.isError ? (
        <ErrorAlert message="插画上传失败，请确认文件格式与大小后重试" />
      ) : null}
      {uploadImage.isSuccess ? (
        <div className="alert alert-success" role="status">
          <div className="alert-body">
            <strong>插画已更新</strong>
            <span>
              小程序下次进入首页拉取运行配置后展示新插画；未配置或加载失败时回退内置视觉。
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
