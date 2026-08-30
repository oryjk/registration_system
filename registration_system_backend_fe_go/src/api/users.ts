import type {
  WeChatUser,
  WeChatUserListPage,
  WeChatUserListQuery,
} from "../types/user";
import { request } from "./client";

function buildQuery(query: WeChatUserListQuery) {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.match_admin_only) params.set("match_admin_only", "true");
  if (query.page) params.set("page", String(query.page));
  if (query.page_size) params.set("page_size", String(query.page_size));
  const value = params.toString();
  return value ? `?${value}` : "";
}

export function listWeChatUsers(query: WeChatUserListQuery) {
  return request<WeChatUserListPage>(`/users${buildQuery(query)}`);
}

export function setMatchAdmin(userID: number) {
  return request<WeChatUser>(`/users/${userID}/match-admin`, {
    method: "PUT",
  });
}

export function unsetMatchAdmin(userID: number) {
  return request<WeChatUser>(`/users/${userID}/match-admin`, {
    method: "DELETE",
  });
}
