import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listWeChatUsers,
  setMatchAdmin,
  unsetMatchAdmin,
} from "../../api/users";
import type { WeChatUserListQuery } from "../../types/user";
import { queryKeys } from "./keys";

function invalidateWeChatUsers(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: ["users"] });
}

export function useWeChatUsersQuery(query: WeChatUserListQuery) {
  return useQuery({
    queryKey: queryKeys.weChatUsers(query),
    queryFn: () => listWeChatUsers(query),
    retry: false,
  });
}

export function useSetMatchAdminMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userID: number) => setMatchAdmin(userID),
    onSuccess: () => invalidateWeChatUsers(queryClient),
  });
}

export function useUnsetMatchAdminMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userID: number) => unsetMatchAdmin(userID),
    onSuccess: () => invalidateWeChatUsers(queryClient),
  });
}
