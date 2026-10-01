import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot } from "react-dom/client";
import {
  addTeamMember,
  removeTeamMember,
  updateTeam,
  updateTeamMemberPaidMembership,
} from "@/api/teams";
import type { Team, TeamMember, TeamMemberManagement } from "@/types/team";
import { queryKeys } from "./keys";
import {
  useAddTeamMemberMutation,
  useRemoveTeamMemberMutation,
  useUpdateTeamMemberPaidMembershipMutation,
  useUpdateTeamMutation,
} from "./useTeamQueries";

vi.mock("@/api/teams", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/api/teams")>()),
  addTeamMember: vi.fn(),
  removeTeamMember: vi.fn(),
  updateTeam: vi.fn(),
  updateTeamMemberPaidMembership: vi.fn(),
}));

const team: Team = {
  id: 1,
  name: "成员统计球队",
  logo_url: null,
  description: null,
  captain_id: null,
  captain: null,
  status: "active",
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
};

const member: TeamMember = {
  id: 1,
  user_id: 10,
  nickname: "队员",
  avatar_url: null,
  real_name: null,
  phone_number: null,
  role: "member",
  status: "inactive",
  joined_at: team.created_at,
  is_paid_member: false,
  balance_cents: 0,
  last_recharge_at: null,
};

async function mountMutations(queryClient: QueryClient) {
  const container = document.createElement("div");
  const root = createRoot(container);
  let mutations:
    | {
        add: ReturnType<typeof useAddTeamMemberMutation>;
        remove: ReturnType<typeof useRemoveTeamMemberMutation>;
        update: ReturnType<typeof useUpdateTeamMutation>;
        membership: ReturnType<
          typeof useUpdateTeamMemberPaidMembershipMutation
        >;
      }
    | undefined;
  function Harness() {
    mutations = {
      add: useAddTeamMemberMutation(),
      remove: useRemoveTeamMemberMutation(),
      update: useUpdateTeamMutation(),
      membership: useUpdateTeamMemberPaidMembershipMutation(),
    };
    return null;
  }
  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <Harness />
      </QueryClientProvider>,
    );
  });
  if (!mutations) throw new Error("mutation hooks did not mount");
  return {
    ...mutations,
    unmount: async () => {
      await act(async () => root.unmount());
      queryClient.clear();
    },
  };
}

describe("team list member counts", () => {
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });
  afterAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
  });
  afterEach(() => vi.clearAllMocks());

  it("updates the list after adding and removing members, including inactive members", async () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.teams, [{ ...team, member_count: 0 }]);
    const mutations = await mountMutations(client);
    try {
      vi.mocked(addTeamMember).mockResolvedValue({ team, members: [member] });
      await act(async () => {
        await mutations.add.mutateAsync({
          teamID: 1,
          payload: { user_id: 10, role: "member" },
        });
      });
      expect(
        client.getQueryData<Team[]>(queryKeys.teams)?.[0].member_count,
      ).toBe(1);

      vi.mocked(removeTeamMember).mockResolvedValue({ team, members: [] });
      await act(async () => {
        await mutations.remove.mutateAsync({ teamID: 1, userID: 10 });
      });
      expect(
        client.getQueryData<Team[]>(queryKeys.teams)?.[0].member_count,
      ).toBe(0);
    } finally {
      await mutations.unmount();
    }
  });

  it("preserves the list count when editing a team returns no count", async () => {
    const client = new QueryClient();
    client.setQueryData(queryKeys.teams, [{ ...team, member_count: 39 }]);
    const mutations = await mountMutations(client);
    try {
      vi.mocked(updateTeam).mockResolvedValue({ ...team, name: "更新球队" });
      await act(async () => {
        await mutations.update.mutateAsync({
          id: 1,
          payload: { name: "更新球队", description: null, status: "active" },
        });
      });
      expect(client.getQueryData<Team[]>(queryKeys.teams)?.[0]).toMatchObject({
        name: "更新球队",
        member_count: 39,
      });
    } finally {
      await mutations.unmount();
    }
  });

  it("updates paid membership from the saved response without changing fund data", async () => {
    const client = new QueryClient();
    const original = {
      ...member,
      balance_cents: 30000,
      last_recharge_at: team.created_at,
    };
    client.setQueryData(queryKeys.teamMembers(team.id), {
      team,
      members: [original],
    });
    const mutations = await mountMutations(client);
    try {
      for (const isPaidMember of [true, false]) {
        vi.mocked(updateTeamMemberPaidMembership).mockResolvedValue({
          team,
          members: [{ ...original, is_paid_member: isPaidMember }],
        });
        await act(async () => {
          await mutations.membership.mutateAsync({
            teamID: team.id,
            userID: original.user_id,
            payload: { is_paid_member: isPaidMember },
          });
        });
        expect(updateTeamMemberPaidMembership).toHaveBeenLastCalledWith(
          team.id,
          original.user_id,
          { is_paid_member: isPaidMember },
        );
        expect(
          client.getQueryData<TeamMemberManagement>(
            queryKeys.teamMembers(team.id),
          )?.members[0],
        ).toEqual({ ...original, is_paid_member: isPaidMember });
      }
    } finally {
      await mutations.unmount();
    }
  });

  it("keeps the original membership when saving fails", async () => {
    const client = new QueryClient();
    const original = { team, members: [member] };
    client.setQueryData(queryKeys.teamMembers(team.id), original);
    const mutations = await mountMutations(client);
    try {
      vi.mocked(updateTeamMemberPaidMembership).mockRejectedValue(
        new Error("保存失败"),
      );
      await act(async () => {
        await expect(
          mutations.membership.mutateAsync({
            teamID: team.id,
            userID: member.user_id,
            payload: { is_paid_member: true },
          }),
        ).rejects.toThrow("保存失败");
      });
      expect(client.getQueryData(queryKeys.teamMembers(team.id))).toEqual(
        original,
      );
    } finally {
      await mutations.unmount();
    }
  });
});
