import { type ReactNode, useState } from "react";

import { ImageLightbox } from "@/components/admin/image-lightbox";
import { cn } from "@/lib/utils";

/**
 * 人员单元格：头像 + 名称（+ 可选副行信息）。
 * 球队队长列、比赛报名名单、成员管理列表共用；有头像时点击可放大查看。
 */
export function MemberCell({
  avatarUrl,
  name,
  secondary,
  tertiary,
  metadata,
  size = "sm",
}: {
  avatarUrl?: string | null;
  name: string;
  secondary?: string;
  tertiary?: string;
  /** 紧凑的第二行，可组合姓名、编号等元信息；旧用法保持不变。 */
  metadata?: ReactNode;
  size?: "sm" | "lg";
}) {
  const [previewOpen, setPreviewOpen] = useState(false);

  return (
    <span className="member-cell">
      {avatarUrl ? (
        <>
          <button
            aria-label={`查看${name}的头像`}
            className={cn(
              "member-avatar-button",
              size === "lg" && "member-avatar-lg",
            )}
            onClick={() => setPreviewOpen(true)}
            type="button"
          >
            <img alt="" className="member-avatar" src={avatarUrl} />
          </button>
          <ImageLightbox
            caption={name}
            onOpenChange={setPreviewOpen}
            open={previewOpen}
            src={avatarUrl}
          />
        </>
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "member-avatar member-avatar-fallback",
            size === "lg" && "member-avatar-lg",
          )}
        >
          {name.slice(0, 1)}
        </span>
      )}
      <span className="match-name-cell">
        <strong title={name}>{name}</strong>
        {secondary ? <span>{secondary}</span> : null}
        {tertiary ? <span>{tertiary}</span> : null}
        {metadata ? (
          <span className="member-cell-metadata">{metadata}</span>
        ) : null}
      </span>
    </span>
  );
}

/** 两行单元格：主标题 + 副标题（比赛/球队列表首列共用）。 */
export function NameCell({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="match-name-cell">
      <strong>{title}</strong>
      {subtitle ? <span>{subtitle}</span> : null}
    </div>
  );
}
