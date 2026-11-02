import { type ChangeEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  useSetVenueImageMutation,
  useUploadVenueImageMutation,
} from "@/hooks/queries/useVenueQueries";
import type { VenueItem } from "@/types/venue";

export function VenueImageCell({ venue }: { venue: VenueItem }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadImage = useUploadVenueImageMutation();
  const setImage = useSetVenueImageMutation();
  const [validationError, setValidationError] = useState("");
  const [failedPreviewUrl, setFailedPreviewUrl] = useState("");
  const busy = uploadImage.isPending || setImage.isPending;
  const previewFailed = failedPreviewUrl === venue.image_url;
  const error =
    validationError ||
    (uploadImage.error instanceof Error ? uploadImage.error.message : "") ||
    (setImage.error instanceof Error ? setImage.error.message : "");

  async function saveImage(imageUrl: string) {
    setValidationError("");
    uploadImage.reset();
    setImage.reset();
    await setImage.mutateAsync({ location: venue.location, imageUrl });
  }

  async function handleSelectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || busy) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 2 * 1024 * 1024 ||
      file.size === 0
    ) {
      setValidationError("请选择 JPG / PNG / WebP 图片，文件不超过 2MB");
      return;
    }
    setValidationError("");
    uploadImage.reset();
    setImage.reset();
    try {
      const { image_url } = await uploadImage.mutateAsync(file);
      await setImage.mutateAsync({
        location: venue.location,
        imageUrl: image_url,
      });
      setFailedPreviewUrl("");
    } catch {
      // Mutation errors are rendered below.
    }
  }

  return (
    <div className="grid min-w-56 gap-2">
      <div className="flex items-center gap-3">
        {venue.image_url && !previewFailed ? (
          <img
            alt={`${venue.location}球场图片`}
            className="size-20 shrink-0 rounded-md border border-border bg-muted object-cover"
            onError={() => setFailedPreviewUrl(venue.image_url)}
            src={venue.image_url}
          />
        ) : (
          <span className="cell-secondary">
            {previewFailed ? "图片加载失败" : "暂未上传"}
          </span>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            accept="image/jpeg,image/png,image/webp"
            aria-label={`选择${venue.location}球场图片`}
            className="hidden"
            disabled={busy}
            onChange={(event) => void handleSelectFile(event)}
            ref={fileInputRef}
            type="file"
          />
          <Button
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
            size="sm"
            type="button"
            variant="secondary"
          >
            {busy ? "保存中…" : venue.image_url ? "替换图片" : "上传图片"}
          </Button>
          {venue.image_url ? (
            <Button
              disabled={busy}
              onClick={() => void saveImage("").catch(() => undefined)}
              size="sm"
              type="button"
              variant="outline"
            >
              移除
            </Button>
          ) : null}
        </div>
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">
        JPG / PNG / WebP，不超过 2MB；保存后小程序可选球场卡片显示
      </p>
    </div>
  );
}
