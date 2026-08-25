import type { AppCaptainThreadSummary } from "@/types/captainMessage";
import { formatDateLabel } from "@/utils/datetime";

export interface CaptainThreadItemViewModel {
  id: string;
  /** 列表标题：我是发起人时显示球队，否则显示留言用户。 */
  title: string;
  subtitle: string;
  preview: string;
  avatarUrl: string;
  timeLabel: string;
  /** 最新一条是否由我发出（决定摘要前缀）。 */
  latestFromMe: boolean;
}

/** 消息中心「留言」列表项：按视角渲染对方信息与最新消息摘要。 */
export function buildCaptainThreadItems(
  threads: AppCaptainThreadSummary[],
  myUserId: number | null,
): CaptainThreadItemViewModel[] {
  return threads.map((thread) => {
    const iAmOwner = myUserId !== null && thread.thread_owner_user_id === myUserId;
    const latestFromMe = iAmOwner ? !thread.latest_sender_is_captain_side : thread.latest_sender_is_captain_side;
    return {
      id: thread.id,
      title: iAmOwner ? `${thread.host_team_name} · 队长` : thread.owner.nickname || `用户 ${thread.thread_owner_user_id}`,
      subtitle: thread.match_name,
      preview: `${latestFromMe ? "我" : "对方"}：${thread.latest_content}`,
      avatarUrl: iAmOwner ? "" : thread.owner.avatar_url || "",
      timeLabel: formatDateLabel(thread.latest_created_at),
      latestFromMe,
    };
  });
}
