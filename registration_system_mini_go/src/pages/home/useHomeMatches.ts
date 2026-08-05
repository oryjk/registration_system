import { ref } from "vue";
import { getHomeMatches } from "@/api/match";
import type { HomeActionMatch, HomeMatchesResponse, MatchRegistrationStatus } from "@/types/api";

const weekdayFormatter = new Intl.DateTimeFormat("zh-CN", { weekday: "short" });
const monthDayFormatter = new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit" });
const dateFormatter = new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", weekday: "short" });
const timeFormatter = new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });

function parseDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatMonthDay(value: string) {
  const date = parseDate(value);
  return date ? monthDayFormatter.format(date).replace("/", ".") : "--.--";
}

export function formatWeekday(value: string) {
  const date = parseDate(value);
  return date ? weekdayFormatter.format(date) : "待定";
}

export function formatDate(value: string) {
  const date = parseDate(value);
  return date ? dateFormatter.format(date).replace("/", ".") : "时间待定";
}

export function formatTime(value: string) {
  const date = parseDate(value);
  return date ? timeFormatter.format(date) : "--:--";
}

const registrationLabels: Record<MatchRegistrationStatus, string> = {
  unknown: "未表态",
  attending: "参加",
  leave: "请假",
  absent: "缺席",
  cancelled: "未报名",
};

export function registrationLabel(status: MatchRegistrationStatus | null) {
  return status ? registrationLabels[status] : "未报名";
}

export function matchActionLabel(match: HomeActionMatch) {
  const canRegister =
    match.status === "registering" &&
    match.group.status === "open" &&
    match.group.my_registration_status !== "attending";
  return canRegister ? "去报名" : "查看详情";
}

export function matchProgress(match: HomeActionMatch) {
  const target = match.group.max_players ?? match.players_per_team;
  if (target <= 0) return 0;
  return Math.min(100, Math.round((match.group.attending_count / target) * 100));
}

export function matchTarget(match: HomeActionMatch) {
  return match.group.max_players ?? match.players_per_team;
}

export function opponentName(match: Pick<HomeActionMatch, "opponent_name">) {
  return match.opponent_name.trim() || "对手待定";
}

export function startHint(match: HomeActionMatch) {
  if (match.status === "ongoing") return "比赛进行中";
  return `${formatDate(match.start_time)} ${formatTime(match.start_time)} 开赛`;
}

export function useHomeMatches() {
  const homeData = ref<HomeMatchesResponse | null>(null);
  const loading = ref(false);
  const errorMessage = ref("");

  async function load() {
    loading.value = true;
    errorMessage.value = "";
    try {
      homeData.value = await getHomeMatches();
      return null;
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "首页比赛加载失败";
      return error;
    } finally {
      loading.value = false;
    }
  }

  function reset() {
    homeData.value = null;
    errorMessage.value = "";
  }

  return { homeData, loading, errorMessage, load, reset };
}
