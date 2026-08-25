import type {
  AppCaptainThreadCreatedResponse,
  AppCaptainThreadDetail,
  AppCaptainThreadListResponse,
} from "@/types/captainMessage";
import { buildQueryString } from "@/utils/queryString";
import { requestApi } from "@/utils/request";

export function listCaptainThreads(params: { page: number; pageSize: number }) {
  const queryString = buildQueryString({ page: params.page, page_size: params.pageSize });
  return requestApi<AppCaptainThreadListResponse>({
    url: `/captain-messages?${queryString}`,
    auth: true,
  });
}

export function getCaptainThread(threadId: string) {
  return requestApi<AppCaptainThreadDetail>({
    url: `/captain-messages/${threadId}`,
    auth: true,
  });
}

export function sendCaptainMessage(matchId: string, content: string) {
  return requestApi<AppCaptainThreadCreatedResponse>({
    url: `/matches/${matchId}/captain-messages`,
    method: "POST",
    data: { content },
    auth: true,
  });
}

export function replyCaptainMessage(threadId: string, content: string) {
  return requestApi<AppCaptainThreadCreatedResponse>({
    url: `/captain-messages/${threadId}/reply`,
    method: "POST",
    data: { content },
    auth: true,
  });
}
