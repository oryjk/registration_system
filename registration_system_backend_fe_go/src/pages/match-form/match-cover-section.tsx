import { type ChangeEvent, useRef, useState } from "react";
import { type UseFormReturn, useWatch } from "react-hook-form";
import { ErrorAlert } from "@/components/admin/error-alert";
import { Button } from "@/components/ui/button";
import type { useUploadMatchCoverImageMutation } from "@/hooks/queries/useMatchQueries";
import type { MatchFormValues } from "@/pages/match-form/schema";

export const defaultMatchCoverUrl =
  "https://oryjk.cn:82/registration/match-covers/default-football-v1.webp";

interface MatchCoverSectionProps {
  form: UseFormReturn<MatchFormValues>;
  uploadImage: ReturnType<typeof useUploadMatchCoverImageMutation>;
  disabled: boolean;
}

export function MatchCoverSection({
  form,
  uploadImage,
  disabled,
}: MatchCoverSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [validationError, setValidationError] = useState("");
  const [failedPreviewUrl, setFailedPreviewUrl] = useState("");
  const coverUrl = useWatch({ control: form.control, name: "cover_image_url" });
  const previewUrl = coverUrl || defaultMatchCoverUrl;
  const previewFailed = failedPreviewUrl === previewUrl;
  const busy = disabled || uploadImage.isPending;

  function handleSelectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;
    uploadImage.reset();
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024 ||
      file.size === 0
    ) {
      setValidationError("请选择 JPG / PNG / WebP 图片，文件不超过 2MB");
      return;
    }
    setValidationError("");
    uploadImage.mutate(file, {
      onSuccess: ({ image_url }) => {
        setFailedPreviewUrl("");
        form.setValue("cover_image_url", image_url, {
          shouldDirty: true,
          shouldValidate: true,
        });
      },
    });
  }

  return (
    <section aria-label="比赛封面" className="form-section">
      <div className="form-section-title">
        <span className="panel-kicker">COVER</span>
        <h4>比赛封面</h4>
      </div>
      <p className="setting-row-description">
        用于小程序比赛卡片背景，未设置时使用默认足球封面。支持 JPG / PNG /
        WebP，不超过 2MB、1600 万像素。封面调整在保存比赛后生效。
      </p>
      <div className="flex flex-wrap items-center gap-4">
        <img
          alt={coverUrl ? "自定义比赛封面预览" : "默认比赛封面预览"}
          className="aspect-video w-72 max-w-full rounded-md border border-border bg-muted object-cover"
          key={previewUrl}
          onError={() => setFailedPreviewUrl(previewUrl)}
          src={previewFailed ? defaultMatchCoverUrl : previewUrl}
        />
        <div className="grid gap-2">
          <p className="text-sm text-muted-foreground" role="status">
            {uploadImage.isPending
              ? "封面上传中，请稍候再保存比赛"
              : coverUrl
                ? "当前使用自定义封面"
                : "当前使用默认封面"}
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              accept="image/jpeg,image/png,image/webp"
              aria-label="选择比赛封面"
              className="hidden"
              disabled={busy}
              onChange={handleSelectFile}
              ref={fileInputRef}
              type="file"
            />
            <Button
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
              type="button"
              variant="secondary"
            >
              {uploadImage.isPending ? "上传中…" : "上传封面"}
            </Button>
            {coverUrl ? (
              <Button
                disabled={busy}
                onClick={() => {
                  uploadImage.reset();
                  setValidationError("");
                  form.setValue("cover_image_url", "", {
                    shouldDirty: true,
                    shouldValidate: true,
                  });
                }}
                type="button"
                variant="outline"
              >
                恢复默认封面
              </Button>
            ) : null}
          </div>
        </div>
      </div>
      {previewFailed ? (
        <p className="text-sm text-muted-foreground">
          封面加载失败，预览已尝试使用默认封面；可重新上传图片。
        </p>
      ) : null}
      {validationError ? <ErrorAlert message={validationError} /> : null}
      {uploadImage.isError ? (
        <ErrorAlert
          message={
            uploadImage.error instanceof Error
              ? uploadImage.error.message
              : "封面上传失败，请重试"
          }
        />
      ) : null}
      {form.formState.errors.cover_image_url ? (
        <ErrorAlert
          message={
            form.formState.errors.cover_image_url.message || "封面地址无效"
          }
        />
      ) : null}
    </section>
  );
}
