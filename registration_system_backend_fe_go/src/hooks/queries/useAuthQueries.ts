import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCurrentAdmin, loginAdmin } from "../../api/auth";
import {
  clearAdminToken,
  getAdminToken,
  setAdminToken,
} from "../../auth/token-storage";
import { findAdminServer, setAdminServer } from "../../config/api";
import { queryKeys } from "./keys";

export interface AdminLoginInput {
  username: string;
  password: string;
  serverId: string;
}

export function useCurrentAdminQuery(enabled = Boolean(getAdminToken())) {
  return useQuery({
    queryKey: queryKeys.currentAdmin,
    queryFn: getCurrentAdmin,
    enabled,
    retry: false,
  });
}

export function useLoginMutation() {
  return useMutation({
    mutationFn: ({ username, password, serverId }: AdminLoginInput) =>
      loginAdmin(username, password, findAdminServer(serverId).baseUrl),
    onSuccess: (result, { serverId }) => {
      setAdminServer(findAdminServer(serverId).id);
      setAdminToken(result.access_token);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();

  return () => {
    clearAdminToken();
    queryClient.clear();
  };
}
