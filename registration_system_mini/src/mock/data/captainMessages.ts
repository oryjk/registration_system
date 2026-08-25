import type {
  AppCaptainMessageItem,
  AppCaptainThreadDetail,
  AppCaptainThreadSummary,
} from "@/types/captainMessage";

/**
 * 「联系队长」留言的内存 mock：仅 H5 mock 模式使用。
 * 数据不持久化，刷新后清空；视角固定当前 mock 用户（user 1）。
 */

const CURRENT_USER_ID = 1;

interface MockThread {
  summary: AppCaptainThreadSummary;
  messages: AppCaptainMessageItem[];
}

const threads: MockThread[] = [];

function participant(user_id: number, nickname: string): { user_id: number; nickname: string; avatar_url: string | null } {
  return { user_id, nickname, avatar_url: null };
}

export function mockCaptainThreadList(): { items: AppCaptainThreadSummary[]; total: number; page: number; page_size: number } {
  return { items: threads.map((thread) => thread.summary), total: threads.length, page: 1, page_size: 20 };
}

export function mockCaptainThreadDetail(threadId: string): AppCaptainThreadDetail | null {
  const thread = threads.find((item) => item.summary.id === threadId);
  if (!thread) return null;
  return {
    id: thread.summary.id,
    match_id: thread.summary.match_id,
    team_id: thread.summary.team_id,
    match_name: thread.summary.match_name,
    host_team_name: thread.summary.host_team_name,
    viewer_is_manager: false,
    messages: thread.messages,
  };
}

function appendMessage(thread: MockThread, content: string, fromCaptain: boolean) {
  const message: AppCaptainMessageItem = {
    id: `mock-cm-${Date.now()}-${thread.messages.length}`,
    sender_user_id: fromCaptain ? 999 : CURRENT_USER_ID,
    sender_is_captain_side: fromCaptain,
    content,
    created_at: new Date().toISOString(),
    sender: participant(fromCaptain ? 999 : CURRENT_USER_ID, fromCaptain ? "东安联队队长" : "我"),
  };
  thread.messages.push(message);
  thread.summary.latest_content = content;
  thread.summary.latest_sender_is_captain_side = fromCaptain;
  thread.summary.latest_created_at = message.created_at;
}

export function mockSendCaptainMessage(matchId: string, content: string): { thread_id: string } {
  let thread = threads.find((item) => item.summary.match_id === matchId);
  if (!thread) {
    thread = {
      summary: {
        id: `mock-thread-${Date.now()}`,
        match_id: matchId,
        team_id: 2,
        thread_owner_user_id: CURRENT_USER_ID,
        match_name: "周末约球",
        host_team_name: "东安联队",
        owner: participant(CURRENT_USER_ID, "我"),
        latest_content: content,
        latest_sender_is_captain_side: false,
        latest_created_at: new Date().toISOString(),
      },
      messages: [],
    };
    threads.unshift(thread);
  }
  appendMessage(thread, content, false);
  return { thread_id: thread.summary.id };
}

export function mockReplyCaptainMessage(threadId: string, content: string): { thread_id: string } | null {
  const thread = threads.find((item) => item.summary.id === threadId);
  if (!thread) return null;
  appendMessage(thread, content, false);
  return { thread_id: threadId };
}
