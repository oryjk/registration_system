import { expect, test } from 'bun:test';
import { effectScope, nextTick, ref } from 'vue';
import type { HomeMatchCardViewModel } from '@/types/viewModels';
import type { AppHomeActionMatch, AppMatchDetailResponse } from '@/types/match';
import { useHomeActionDeckDetails } from '../useHomeActionDeckDetails';
import { toHomeMatchCard } from '../homeMatchState';
import { buildHomeActionMatchCardState } from '../homeActionMatchCardState';
const card = (id: string) => ({ id } as HomeMatchCardViewModel);
const detail = (id: string) => ({ match: { id }, groups: [] } as unknown as AppMatchDetailResponse);
test('preloads adjacent details and reuses them on a turn', async () => {
  const scope = effectScope(); const matches = ref(['a', 'b', 'c', 'd'].map(card)); const index = ref(0);
  const calls: string[] = [];
  const state = scope.run(() => useHomeActionDeckDetails(matches, index, async id => { calls.push(id); return detail(id); }))!;
  await nextTick();
  expect(calls).toEqual(['a', 'b', 'd']);
  expect(state.previous.value.detail?.match.id).toEqual('d');
  expect(state.next.value.detail?.match.id).toEqual('b');
  index.value = 1; await nextTick(); await nextTick();
  expect(calls).toEqual(['a', 'b', 'd', 'c']);
  expect(state.active.value.detail?.match.id).toEqual('b');
  expect(state.previous.value.detail?.match.id).toEqual('a');
  scope.stop();
});
test('a refreshed collection rejects late old responses, and failed preload can retry', async () => {
  const scope = effectScope(); const matches = ref([card('a')]); const index = ref(0);
  let finish!: (value: AppMatchDetailResponse) => void;
  let calls = 0;
  const state = scope.run(() => useHomeActionDeckDetails(matches, index, async id => {
    calls++;
    if (calls === 1) return new Promise<AppMatchDetailResponse>(resolve => { finish = resolve; });
    if (calls === 2) throw new Error('offline');
    return detail(id);
  }))!;
  matches.value = [card('a')]; await nextTick(); await nextTick();
  finish(detail('a')); await nextTick();
  expect(state.active.value.error).toEqual(true);
  expect(state.active.value.detail).toEqual(null);
  await state.reload();
  expect(state.active.value.detail?.match.id).toEqual('a');
  expect(state.active.value.error).toEqual(false);
  scope.stop();
});

test('last slide preloads the first slide for circular autoplay', async () => {
  const scope = effectScope();
  const matches = ref(['a', 'b', 'c', 'd'].map(card));
  const index = ref(3);
  const state = scope.run(() => useHomeActionDeckDetails(matches, index, async id => detail(id)))!;
  await nextTick();
  expect(state.next.value.detail?.match.id).toEqual('a');
  index.value = 0;
  await nextTick();
  expect(state.active.value.detail?.match.id).toEqual('a');
  expect(state.previous.value.detail?.match.id).toEqual('d');
  scope.stop();
});

const now = new Date('2026-09-21T10:00:00Z');
function registrationFixture() {
  const source: AppHomeActionMatch = {
    id: 'registration', name: '友谊赛', status: 'registering', publication_mode: 'online_team',
    host_team_name: '主队', opponent_name: '客队', players_per_team: 8, location: '1号场',
    start_time: '2026-09-22T12:00:00Z', end_time: '2026-09-22T14:00:00Z',
    group: { id: 'host', kind: 'host_team', status: 'open', min_players: 6, max_players: 10, attending_count: 5, my_registration_status: 'unknown' },
  };
  const response: AppMatchDetailResponse = {
    match: {
      ...source, host_team_id: 1, away_team_id: 2, away_team_name: '客队', opponent_state: 'confirmed',
      registration_start_at: null, registration_end_at: '2026-09-22T10:00:00Z',
      location_latitude: null, location_longitude: null, description: null,
      created_at: now.toISOString(), updated_at: now.toISOString(),
    },
    groups: [{ ...source.group, team_id: 1, my_registration: null }],
  };
  return { summary: toHomeMatchCard(source, 'upcoming'), response };
}

for (const scenario of [
  { name: 'normal registration', availability: '', action: '前往报名' },
  { name: 'full group', availability: '名额已满', action: '查看比赛详情' },
  { name: 'deadline reached', availability: '报名已关闭', action: '查看比赛详情' },
  { name: 'closed group', availability: '报名已关闭', action: '查看比赛详情' },
  { name: 'ended match', availability: '比赛已结束', action: '查看比赛记录' },
]) {
  test(`loading and failed retry stay neutral until ${scenario.name} is confirmed`, async () => {
    const { summary, response } = registrationFixture();
    if (scenario.name === 'full group') response.groups[0].attending_count = 10;
    if (scenario.name === 'deadline reached') response.match.registration_end_at = now.toISOString();
    if (scenario.name === 'closed group') response.groups[0].status = 'closed';
    if (scenario.name === 'ended match') response.match.status = 'ended';
    let resolve!: (value: AppMatchDetailResponse) => void;
    let reject!: (reason: Error) => void;
    const scope = effectScope();
    const state = scope.run(() => useHomeActionDeckDetails(ref([summary]), ref(0), () =>
      new Promise<AppMatchDetailResponse>((yes, no) => { resolve = yes; reject = no; }),
    ))!;
    const presentation = () => buildHomeActionMatchCardState(summary, state.active.value.detail, now);
    try {
      expect(state.active.value.loading).toEqual(true);
      expect(presentation().availability).toEqual('报名状态待确认');
      expect(presentation().actionLabel).toEqual('查看比赛与报名');
      reject(new Error('offline')); await nextTick();
      expect(state.active.value.error).toEqual(true);
      expect(state.active.value.loading).toEqual(false);
      expect(presentation().availability).toEqual('报名状态待确认');
      const retry = state.reload();
      expect(state.active.value.error).toEqual(false);
      expect(state.active.value.loading).toEqual(true);
      expect(presentation().availability).toEqual('报名状态待确认');
      resolve(response); await retry;
      expect(state.active.value.loading).toEqual(false);
      expect(state.active.value.error).toEqual(false);
      expect(presentation().availability).toEqual(scenario.availability);
      expect(presentation().actionLabel).toEqual(scenario.action);
    } finally {
      scope.stop();
    }
  });
}
