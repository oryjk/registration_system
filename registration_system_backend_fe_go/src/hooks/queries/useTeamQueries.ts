import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  addTeamMember,
  createTeam,
  deleteTeam,
  getTeam,
  listTeamMemberCandidates,
  listTeamMembers,
  listTeams,
  removeTeamMember,
  resetTeamJoinPassword,
  setTeamCaptain,
  updatePlayerProfile,
  updateTeam,
  updateTeamMember,
} from "../../api/teams";
import type {
  AddTeamMemberPayload,
  SaveTeamPayload,
  Team,
  TeamMemberManagement,
  UpdatePlayerProfilePayload,
  UpdateTeamMemberPayload,
} from "../../types/team";
import { queryKeys } from "./keys";
import {
  isTeamCandidateQueryKey,
  isTeamScopedQueryKey,
} from "./team-query-key";

function invalidateTeamLists(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.teams, exact: true }),
    queryClient.invalidateQueries({
      queryKey: queryKeys.teamOptions,
      exact: true,
    }),
  ]);
}

function updateTeamCaches(queryClient: QueryClient, team: Team) {
  queryClient.setQueryData(queryKeys.team(team.id), team);
  queryClient.setQueryData<Team[]>(queryKeys.teams, (current) =>
    current?.map((item) => (item.id === team.id ? team : item)),
  );
}

function updateManagementCaches(
  queryClient: QueryClient,
  result: TeamMemberManagement,
) {
  updateTeamCaches(queryClient, result.team);
  queryClient.setQueryData(queryKeys.teamMembers(result.team.id), result);
}

function invalidateCandidates(queryClient: QueryClient, teamID: number) {
  return queryClient.invalidateQueries({
    predicate: ({ queryKey }) => isTeamCandidateQueryKey(queryKey, teamID),
  });
}

export function useTeamsQuery() {
  return useQuery({
    queryKey: queryKeys.teams,
    queryFn: () => listTeams(),
    retry: false,
  });
}

export function useTeamQuery(teamID: number | null) {
  return useQuery({
    queryKey: queryKeys.team(teamID || 0),
    queryFn: () => getTeam(teamID || 0),
    enabled: Boolean(teamID),
    retry: false,
  });
}

export function useTeamMembersQuery(teamID: number | null, enabled = true) {
  return useQuery({
    queryKey: queryKeys.teamMembers(teamID || 0),
    queryFn: () => listTeamMembers(teamID || 0),
    enabled: Boolean(teamID) && enabled,
    retry: false,
  });
}

export function useTeamMemberCandidatesQuery(
  teamID: number | null,
  search: string,
  enabled: boolean,
) {
  const normalizedSearch = search.trim();
  return useQuery({
    queryKey: queryKeys.teamMemberCandidates(teamID || 0, normalizedSearch),
    queryFn: () => listTeamMemberCandidates(teamID || 0, normalizedSearch),
    enabled: Boolean(teamID) && enabled,
    retry: false,
  });
}

export function useCreateTeamMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: SaveTeamPayload) => createTeam(payload),
    onSuccess: (team) => {
      queryClient.setQueryData(queryKeys.team(team.id), team);
      return invalidateTeamLists(queryClient);
    },
  });
}

export function useUpdateTeamMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Required<SaveTeamPayload>;
    }) => updateTeam(id, payload),
    onSuccess: (team) => {
      updateTeamCaches(queryClient, team);
      return invalidateTeamLists(queryClient);
    },
  });
}

export function useDeleteTeamMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteTeam(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({
        predicate: ({ queryKey }) => isTeamScopedQueryKey(queryKey, id),
      });
      return invalidateTeamLists(queryClient);
    },
  });
}

// 入队密码不进列表缓存，成功后无需 invalidate。
export function useResetTeamJoinPasswordMutation() {
  return useMutation({
    mutationFn: ({ teamID, password }: { teamID: number; password: string }) =>
      resetTeamJoinPassword(teamID, password),
  });
}

function useManagementMutation<TVariables>(
  mutationFn: (variables: TVariables) => Promise<TeamMemberManagement>,
  candidateTeamID: (variables: TVariables) => number | null,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (result, variables) => {
      updateManagementCaches(queryClient, result);
      const teamID = candidateTeamID(variables);
      return teamID ? invalidateCandidates(queryClient, teamID) : undefined;
    },
  });
}

export function useAddTeamMemberMutation() {
  return useManagementMutation(
    ({ teamID, payload }: { teamID: number; payload: AddTeamMemberPayload }) =>
      addTeamMember(teamID, payload),
    ({ teamID }) => teamID,
  );
}

export function useUpdateTeamMemberMutation() {
  return useManagementMutation(
    ({
      teamID,
      userID,
      payload,
    }: {
      teamID: number;
      userID: number;
      payload: UpdateTeamMemberPayload;
    }) => updateTeamMember(teamID, userID, payload),
    () => null,
  );
}

export function useRemoveTeamMemberMutation() {
  return useManagementMutation(
    ({ teamID, userID }: { teamID: number; userID: number }) =>
      removeTeamMember(teamID, userID),
    ({ teamID }) => teamID,
  );
}

export function useSetTeamCaptainMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      teamID,
      userID,
    }: {
      teamID: number;
      userID: number | null;
    }) => setTeamCaptain(teamID, userID),
    onSuccess: (result) => {
      updateManagementCaches(queryClient, result);
      return queryClient.invalidateQueries({
        queryKey: queryKeys.teams,
        exact: true,
      });
    },
  });
}

export function useUpdatePlayerProfileMutation(teamID: number | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      userID,
      payload,
    }: {
      userID: number;
      payload: UpdatePlayerProfilePayload;
    }) => updatePlayerProfile(userID, payload),
    onSuccess: () =>
      teamID
        ? queryClient.invalidateQueries({
            queryKey: queryKeys.teamMembers(teamID),
            exact: true,
          })
        : undefined,
  });
}
