import { cn } from "@/lib/utils";

/**
 * 人员单元格：头像 + 名称（+ 可选副行信息）。
 * 球队队长列、比赛报名名单、成员管理列表共用。
 */
export function MemberCell({
  avatarUrl,
  name,
  secondary,
  tertiary,
  size = "sm",
}: {
  avatarUrl?: string | null;
  name: string;
  secondary?: string;
  tertiary?: string;
  size?: "sm" | "lg";
}) {
  return (
    <span className="member-cell">
      {avatarUrl ? (
        <img
          alt=""
          className={cn("member-avatar", size === "lg" && "member-avatar-lg")}
          src={avatarUrl}
        />
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
        <strong>{name}</strong>
        {secondary ? <span>{secondary}</span> : null}
        {tertiary ? <span>{tertiary}</span> : null}
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
