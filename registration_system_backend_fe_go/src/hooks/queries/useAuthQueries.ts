import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getCurrentAdmin, loginAdmin } from "../../api/auth";
import {
  clearAdminToken,
  getAdminToken,
  setAdminToken,
} from "../../auth/token-storage";
import { queryKeys } from "./keys";

export interface AdminLoginInput {
  username: string;
  password: string;
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
    mutationFn: ({ username, password }: AdminLoginInput) =>
      loginAdmin(username, password),
    onSuccess: (result) => {
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
