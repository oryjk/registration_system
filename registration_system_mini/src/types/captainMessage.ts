/** 「联系队长」留言：比赛发起用户与主队队长/领队之间的私信对话。 */

export interface AppCaptainParticipant {
  user_id: number;
  nickname: string;
  avatar_url: string | null;
}

export interface AppCaptainThreadSummary {
  /** 串首条消息 id，作为对话的对外标识。 */
  id: string;
  match_id: string;
  team_id: number;
  thread_owner_user_id: number;
  match_name: string;
  host_team_name: string;
  owner: AppCaptainParticipant;
  latest_content: string;
  /** 最新一条是否由队长/领队一侧发送。 */
  latest_sender_is_captain_side: boolean;
  latest_created_at: string;
  /** 串内对方发送且我尚未读到的消息数。 */
  unread_count: number;
}

export interface AppCaptainMessageItem {
  id: string;
  sender_user_id: number;
  sender_is_captain_side: boolean;
  content: string;
  created_at: string;
  sender: AppCaptainParticipant;
}

export interface AppCaptainThreadDetail {
  id: string;
  match_id: string;
  team_id: number;
  match_name: string;
  host_team_name: string;
  /** 当前查看者是否为队长/领队一侧（否则为串发起人）。 */
  viewer_is_manager: boolean;
  messages: AppCaptainMessageItem[];
}

export interface AppCaptainThreadListResponse {
  items: AppCaptainThreadSummary[];
  total: number;
  page: number;
  page_size: number;
}

export interface AppCaptainThreadCreatedResponse {
  thread_id: string;
}
