import type { BackendUser } from "@/types/backend";
import type { AppMatchUiPhase } from "@/types/match";
import { formatDateLabel } from "@/utils/datetime";

export type VisibleHomeMatchPhase = Exclude<AppMatchUiPhase, "excluded">;

export function pickFirstNonEmpty(values: Array<string | null | undefined>): string {
  return values.find((value) => value?.trim())?.trim() ?? "";
}

export function toHomeMatchPhaseFromStatus(status: number): VisibleHomeMatchPhase {
  if (status === 1) return "ongoing";
  if (status === 2 || status === 3) return "ended";
  return "upcoming";
}

export function toStandLabel(stand: number): string {
  switch (stand) {
    case 1:
      return "参加";
    case 2:
      return "请假";
    case 3:
      return "缺席";
    default:
      return "待定";
  }
}

export function toActivityStatusLabel(status: number): string {
  switch (status) {
    case 1:
      return "进行中";
    case 2:
      return "已结束";
    case 3:
      return "已取消";
    default:
      return "报名中";
  }
}

export function formatCurrency(value: string | number | null | undefined): string {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  return `¥${amount.toFixed(2)}`;
}

export function formatCompactCurrency(value: string | number | null | undefined): string {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  if (Number.isInteger(amount)) return `¥${amount.toFixed(0)}`;
  return `¥${amount.toFixed(2).replace(/\.?0+$/, "")}`;
}

export function formatDateTimeLabel(isoText: string | null | undefined): string {
  if (!isoText) return "未开通";
  return formatDateLabel(isoText);
}

export function avatarTone(userId: number): string {
  const palette = ["#111111", "#2a4cff", "#0f766e", "#7c3aed", "#ea580c", "#16a34a", "#be123c"];
  return palette[userId % palette.length];
}

export function resolveUserDisplayName(user: BackendUser | null | undefined): string {
  if (!user) return "未登录";
  return pickFirstNonEmpty([user.real_name, user.nickname, user.username]) || `用户 ${user.id}`;
}

export function resolveUserDisplayHandle(user: BackendUser | null | undefined): string {
  if (!user) return "点击重试登录和刷新资料";
  const nickname = pickFirstNonEmpty([user.nickname]);
  if (nickname) return `@${nickname}`;
  const username = pickFirstNonEmpty([user.username]);
  if (username) return username;
  return "已登录，待补充昵称或姓名";
}
