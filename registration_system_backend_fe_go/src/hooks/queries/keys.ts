import type { MatchListQuery } from "../../types/match";
import type { MiniReviewStatusQuery } from "../../types/miniReview";

export const queryKeys = {
  health: ["health"] as const,
  currentAdmin: ["currentAdmin"] as const,
  admins: ["admins"] as const,
  teams: ["teams"] as const,
  teamOptions: ["teams", "options"] as const,
  team: (id: number) => ["teams", id] as const,
  teamMembers: (id: number) => ["teams", id, "members"] as const,
  teamMemberCandidates: (id: number, search: string) =>
    ["teams", id, "member-candidates", search.trim()] as const,
  matches: (query: MatchListQuery) => ["matches", query] as const,
  match: (id: string) => ["matches", id] as const,
  miniReviewStatuses: (query: MiniReviewStatusQuery) => ["mini-review", "statuses", query] as const,
};
