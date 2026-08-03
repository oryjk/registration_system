import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createAdmin, listAdmins } from "../../api/auth";
import type { CreateAdminPayload } from "../../types/auth";
import { queryKeys } from "./keys";

export function useAdminsQuery(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.admins,
    queryFn: listAdmins,
    enabled,
    retry: false,
  });
}

export function useCreateAdminMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateAdminPayload) => createAdmin(payload),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.admins,
        exact: true,
      }),
  });
}
