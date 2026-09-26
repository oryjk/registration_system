import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { ErrorAlert } from "@/components/admin/error-alert";
import { ImageLightbox } from "@/components/admin/image-lightbox";
import { Button } from "@/components/ui/button";
import type {
  useOnboardingImageMutations,
  useUploadNextMatchSocialImageMutation,
} from "@/hooks/queries/useSystemQueries";

export function ImageSetting({
  title,
  description,
  savedImageUrl,
  uploadImage,
  clearImage,
  disabled = false,
  recommendedRatio,
}: {
  title: string;
  description: string;
  savedImageUrl: string;
  uploadImage: ReturnType<typeof useUploadNextMatchSocialImageMutation>;
  clearImage?: ReturnType<typeof useOnboardingImageMutations>["clear"];
  disabled?: boolean;
  recommendedRatio?: number;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState<string | null>(
    null,
  );
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [validationError, setValidationError] = useState("");
  const uploading = uploadImage.isPending;
  const busy = disabled || uploading || !!clearImage?.isPending;
  const previewUrl = selectedPreviewUrl ?? (savedImageUrl || null);

  useEffect(() => {
    return () => {
      if (selectedPreviewUrl) URL.revokeObjectURL(selectedPreviewUrl);
    };
  }, [selectedPreviewUrl]);

  useEffect(() => {
    setDimensions(null);
    if (!selectedPreviewUrl) return;
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (active)
        setDimensions({
          width: image.naturalWidth,
          height: image.naturalHeight,
        });
    };
    image.onerror = () => {
      if (active) setValidationError("无法读取图片尺寸，请重新选择有效图片");
    };
    image.src = selectedPreviewUrl;
    return () => {
      active = false;
    };
  }, [selectedPreviewUrl]);

  function clearSelectedFile() {
    setSelectedFile(null);
    setSelectedPreviewUrl(null);
  }

  function handleSelectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    // 允许连续选择同一个文件重新触发 onChange。
    event.target.value = "";
    uploadImage.reset();
    clearImage?.reset();
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024
    ) {
      clearSelectedFile();
      setValidationError("请选择 PNG / JPG / WebP 图片，文件不超过 2MB");
      return;
    }
    setValidationError("");
    setSelectedFile(file);
    setSelectedPreviewUrl(URL.createObjectURL(file));
  }

  function handleUpload() {
    if (!selectedFile || busy) return;
    uploadImage.mutate(selectedFile, {
      onSuccess: clearSelectedFile,
    });
  }

  return (
    <section className="setting-row" aria-label={title}>
      <div className="setting-row-head">
        <strong>{title}</strong>
        <span className="cell-secondary">
          {savedImageUrl ? "已配置" : "未配置"}
        </span>
      </div>
      <p className="setting-row-description">{description}</p>

      <div className="flex flex-wrap items-center gap-4">
        {previewUrl ? (
          <button
            type="button"
            className="overflow-hidden rounded-[var(--radius)] border border-border"
            onClick={() => setLightboxOpen(true)}
            aria-label={`查看${title}大图`}
          >
            <img
              alt={`${title}预览`}
              className="h-24 w-auto max-w-48 object-contain bg-muted"
              src={previewUrl}
            />
          </button>
        ) : (
          <div className="flex h-24 w-48 items-center justify-center rounded-[var(--radius)] border border-dashed border-border text-sm text-muted-foreground">
            暂未上传图片
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            aria-label={`选择${title}`}
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            type="file"
            onChange={handleSelectFile}
          />
          <Button
            disabled={busy}
            type="button"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            选择图片
          </Button>
          <Button
            disabled={!selectedFile || busy}
            type="button"
            onClick={handleUpload}
          >
            {uploading
              ? "上传中…"
              : savedImageUrl
                ? "上传 / 更换图片"
                : "上传图片"}
          </Button>
          {clearImage && savedImageUrl ? (
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => {
                uploadImage.reset();
                setValidationError("");
                clearImage.mutate(undefined, { onSuccess: clearSelectedFile });
              }}
            >
              {clearImage.isPending ? "清空中…" : "清空图片"}
            </Button>
          ) : null}
          {selectedFile && !busy ? (
            <Button type="button" variant="ghost" onClick={clearSelectedFile}>
              取消
            </Button>
          ) : null}
        </div>
      </div>

      {dimensions ? (
        <p className="setting-row-description" role="status">
          当前图片：{dimensions.width}×{dimensions.height}px，比例{" "}
          {(dimensions.width / dimensions.height).toFixed(2)}:1。
          {recommendedRatio &&
          Math.abs(
            dimensions.width / dimensions.height / recommendedRatio - 1,
          ) > 0.01
            ? " 与建议的 5:4 比例有偏差，分享卡片可能裁切；仍可上传。"
            : null}
        </p>
      ) : null}

      <ImageLightbox
        caption={title}
        open={lightboxOpen}
        src={previewUrl}
        onOpenChange={setLightboxOpen}
      />

      {validationError ? <ErrorAlert message={validationError} /> : null}
      {clearImage?.isError ? (
        <ErrorAlert message="图片清空失败，请重试" />
      ) : null}
      {uploadImage.isError ? (
        <ErrorAlert message="图片上传失败，请确认文件格式与大小后重试" />
      ) : null}
      {uploadImage.isSuccess || clearImage?.isSuccess ? (
        <div className="alert alert-success" role="status">
          <div className="alert-body">
            <strong>图片已更新</strong>
            <span>
              小程序刷新运行配置后生效，无需重新上传小程序；清空或加载失败时显示内置视觉。
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
