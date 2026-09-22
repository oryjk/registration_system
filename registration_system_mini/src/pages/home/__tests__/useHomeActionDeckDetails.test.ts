import { expect, test } from 'bun:test';
import { effectScope, nextTick, ref } from 'vue';
import type { HomeMatchCardViewModel } from '@/types/viewModels';
import type { AppMatchDetailResponse } from '@/types/match';
import { useHomeActionDeckDetails } from '../useHomeActionDeckDetails';
const card = (id: string) => ({ id } as HomeMatchCardViewModel);
const detail = (id: string) => ({ match: { id }, groups: [] } as unknown as AppMatchDetailResponse);
test('preloads adjacent details and reuses them on a turn', async () => {
  const scope = effectScope(); const matches = ref(['a', 'b', 'c', 'd'].map(card)); const index = ref(0);
  const calls: string[] = [];
  const state = scope.run(() => useHomeActionDeckDetails(matches, index, async id => { calls.push(id); return detail(id); }))!;
  await nextTick();
  expect(calls).toEqual(['a', 'b']);
  expect(state.next.value.detail?.match.id).toEqual('b');
  index.value = 1; await nextTick(); await nextTick();
  expect(calls).toEqual(['a', 'b', 'c']);
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
