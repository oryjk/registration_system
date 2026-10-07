import { expect, test } from "bun:test";
import type { BackendTeamAttendanceRankingItem } from "@/types/backend";
import { sortParticipationRanking } from "../teamStatsState";

test("annual ranking uses points and server tie order without mutating source", () => {
  const items = [
    { user_id: 1, participation_points: 79.9, participation_rank: 3 },
    { user_id: 3, participation_points: 80.1, participation_rank: 2 },
    { user_id: 2, participation_points: 80.1, participation_rank: 1 },
  ] as BackendTeamAttendanceRankingItem[];
  expect(sortParticipationRanking(items).map(item => item.user_id)).toEqual([2, 3, 1]);
  expect(items.map(item => item.user_id)).toEqual([1, 3, 2]);
});

test("old response keeps unknown score and order", () => {
 const items = [{user_id:2},{user_id:1}] as BackendTeamAttendanceRankingItem[];
 expect(sortParticipationRanking(items).map(item=>item.user_id)).toEqual([2,1]);
 expect(sortParticipationRanking(items)[0].participation_points).toEqual(undefined);
});
