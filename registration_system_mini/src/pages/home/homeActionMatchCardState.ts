import { registrationProgressState } from "@/components/ui/registrationProgressState";
import type { AppMatchDetailResponse } from "@/types/match";
import type { HomeMatchCardViewModel } from "@/types/viewModels";
import { formatDateLabel, formatTimeLabel, formatWeekdayLabel, parseDateValue } from "@/utils/datetime";
import { resolveRegistrationWindow } from "@/utils/registrationWindow";
import { resolveMatchPhase } from "./homeMatchState";

function dateIsValid(value?: string | null): value is string {
  return !!value && Number.isFinite(parseDateValue(value).getTime());
}

function feeLabel(detail?: AppMatchDetailResponse | null): string {
  const match = detail?.match;
  if (!match) return "费用见比赛详情";
  if (match.fee_type === "team_fund") return "队费扣除";
  if (match.fee_type === "offline_aa") return "线下 AA";
  if (match.is_free === true) return "免费报名";
  if (typeof match.fee_per_person_cents !== "number" || match.fee_per_person_cents <= 0) return "费用见比赛详情";
  const price = (match.fee_per_person_cents / 100).toFixed(2).replace(/\.00$/, "");
  const mode = match.payment_mode === "prepaid" ? "赛前支付" : match.payment_mode === "postpaid" ? "赛后结算" : "支付方式见详情";
  return `¥${price} / 人 · ${mode}`;
}

/** 仅推导展示与导航文案；不代替详情页和后端的报名资格/支付校验。 */
export function buildHomeActionMatchCardState(
  card: HomeMatchCardViewModel,
  response: AppMatchDetailResponse | null = null,
  now = new Date(),
) {
  const detail = response?.match.id === card.id ? response : null;
  const match = detail?.match;
  const group = detail?.groups.find((item) => item.id === card.registrationGroupId);
  const phase = match ? resolveMatchPhase(match, now) : card.phase;
  const rawDate = match?.start_time ?? card.dateSource;
  const validDate = dateIsValid(rawDate);
  const registration = group?.my_registration;
  const status = group
    ? ({ attending: "已报名", leave: "已请假", absent: "缺席", cancelled: "已取消报名", unknown: "尚未报名" }[registration?.status ?? "unknown"])
    : ({ 参加: "已报名", 请假: "已请假", 缺席: "缺席", 取消: "已取消报名", 待定: "尚未报名" }[card.myStatus ?? ""] ?? "报名状态见详情");
  const attending = group ? registration?.status === "attending" : card.myStatus === "参加";
  const pendingPayment = !!attending && !!registration && registration.paid === false && match?.payment_mode === "prepaid" && (match.fee_per_person_cents ?? 0) > 0;
  const joined = group?.attending_count ?? card.joinedPlayers;
  // null 表示未设置限制，不能把首页兼容字段的默认值误当作人数上限。
  // 成行线例外：组未设 min_players 时回落到赛制人数，与首页列表口径一致，
  // 避免详情到达后目标线消失、进度条由待成行黄色翻成已就绪绿色。
  const playersPerTeam = match?.players_per_team ?? 0;
  const minimum = group
    ? group.min_players ?? (playersPerTeam > 0 ? playersPerTeam : null)
    : card.requiredPlayers || null;
  const maximum = group ? group.max_players : card.maxPlayers || null;
  const full = maximum !== null && maximum > 0 && joined >= maximum;
  const window = match ? resolveRegistrationWindow({
    now: now.getTime(),
    isRegistering: match.status === "registering" && group?.status === "open",
    registrationStartAt: match.registration_start_at,
    registrationEndAt: match.registration_end_at,
    matchEndAt: match.end_time,
  }) : null;
  let phaseLabel = "下一场比赛";
  let availability = "";
  let actionLabel = "查看比赛与报名";
  if (phase === "excluded") {
    phaseLabel = "比赛已取消";
    availability = "比赛已取消";
    actionLabel = "查看比赛详情";
  } else if (phase === "ended") {
    phaseLabel = "最近一场比赛";
    availability = "比赛已结束";
    actionLabel = "查看比赛记录";
  } else if (phase === "ongoing") {
    phaseLabel = "正在进行";
    availability = "比赛进行中";
    actionLabel = "查看比赛安排";
  } else if (group) {
    availability = group.status === "cancelled" ? "报名组已取消"
      : window?.state === "not_started" ? "报名尚未开始"
      : window?.state === "closed" ? "报名已关闭"
      : full ? "名额已满" : "";
    actionLabel = pendingPayment ? "查看报名与支付"
      : attending ? "查看比赛安排"
      : availability ? "查看比赛详情" : "前往报名";
  }
  const progress = registrationProgressState(joined, minimum, maximum);
  const deadline = match?.registration_end_at;
  const deadlineLabel = dateIsValid(deadline) ? `${formatDateLabel(deadline)} 截止` : "";
  return {
    phaseLabel,
    phase,
    title: match?.name || card.title,
    date: validDate ? formatDateLabel(rawDate).split(" ")[0] : "日期待定",
    weekday: validDate ? formatWeekdayLabel(rawDate) : "",
    time: validDate ? formatTimeLabel(rawDate) : "时间待定",
    venue: match?.location?.trim() || card.venue?.trim() || "场地待定",
    opponent: match?.opponent_name?.trim() || card.opponent?.trim() || "待定",
    feeLabel: feeLabel(detail),
    statusLabel: pendingPayment ? "已报名 · 待支付" : status,
    statusTone: pendingPayment ? "warning" : status === "已报名" ? "success" : status === "已请假" ? "warning" : status === "缺席" ? "danger" : "neutral",
    statusIcon: pendingPayment ? "clock" : status === "已报名" ? "circle-check" : status === "已请假" ? "user-round-minus" : status === "缺席" || status === "已取消报名" ? "circle-x" : status === "尚未报名" ? "user-round" : "circle-help",
    availability,
    actionLabel,
    joined,
    deadlineLabel,
    ...progress,
    avatars: group?.participants?.filter((item) => item.status === "attending").map((item) => ({
      id: item.user_id, name: item.nickname || "球友", avatarUrl: item.avatar_url || undefined,
    })) ?? card.participantAvatars.map((item) => ({ id: item.userId, name: item.displayText, avatarUrl: item.avatarUrl || undefined })),
  };
}
