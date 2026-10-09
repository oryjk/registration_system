import { expect, test } from "bun:test";
import type { BackendTeamAttendanceRankingItem } from "@/types/backend";
import { buildActivityRanking } from "../activityRanking";

const rows = (...items: Array<{ user_id: number; participation_points?: number; participation_rank?: number }>) =>
  items as BackendTeamAttendanceRankingItem[];

test("annual scores and order stay annual while tiers use the same user's cumulative stars", () => {
  const annual = rows(
    { user_id: 2, participation_points: 10, participation_rank: 2 },
    { user_id: 1, participation_points: 100, participation_rank: 1 },
  );
  const cumulative = rows(
    { user_id: 1, participation_points: 100 },
    { user_id: 2, participation_points: 655.5 },
  );
  const result = buildActivityRanking(annual, cumulative);
  expect(result.map((item) => item.user_id)).toEqual([1, 2]);
  expect(result.map((item) => item.participation_points)).toEqual([100, 10]);
  expect(result.map((item) => item.tier?.title)).toEqual(["秩序白银", "最强王者"]);
  expect(annual.map((item) => item.user_id)).toEqual([2, 1]);
  expect("tier" in annual[0]).toEqual(false);
});

test("history stars keep server tie order and share annual tiers", () => {
  const cumulative = rows(
    { user_id: 2, participation_points: 200, participation_rank: 2 },
    { user_id: 1, participation_points: 200, participation_rank: 1 },
  );
  const history = buildActivityRanking(cumulative, cumulative);
  const annual = buildActivityRanking(rows({ user_id: 1, participation_points: 5 }), cumulative);
  expect(history.map((item) => item.user_id)).toEqual([1, 2]);
  expect(history[0].tier).toEqual(annual[0].tier);
});

test("zero cumulative stars have bronze; missing or invalid cumulative data never infer a tier", () => {
  const items = rows(...[1, 2, 3, 4, 5].map((user_id) => ({ user_id, participation_points: 500 })));
  const cumulative = rows(
    { user_id: 1, participation_points: 0 },
    { user_id: 3, participation_points: -1 },
    { user_id: 4, participation_points: NaN },
    { user_id: 5 },
  );
  expect(buildActivityRanking(items, cumulative).map((item) => item.tier?.title ?? null))
    .toEqual(["倔强青铜", null, null, null, null]);
  expect(buildActivityRanking([], cumulative)).toEqual([]);
});
