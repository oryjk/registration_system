import { computed, onScopeDispose, shallowRef, watch, type Ref } from 'vue';
import { getMatchDetail } from '@/api/match';
import type { AppMatchDetailResponse } from '@/types/match';
import type { HomeMatchCardViewModel } from '@/types/viewModels';

export type HomeMatchDetailEntry = { detail: AppMatchDetailResponse | null; loading: boolean; error: boolean };
const empty: HomeMatchDetailEntry = { detail: null, loading: false, error: false };

/** 只保留当前及相邻两场；刷新比赛集合时失效，旧请求不能污染新球队/新一轮数据。 */
export function useHomeActionDeckDetails(
  matches: Readonly<Ref<HomeMatchCardViewModel[]>>,
  index: Readonly<Ref<number>>,
  fetchDetail = getMatchDetail,
) {
  const entries = shallowRef<Record<string, HomeMatchDetailEntry>>({});
  let generation = 0;
  const requests = new Map<string, symbol>();
  let disposed = false;
  function entryAt(offset: number): HomeMatchDetailEntry {
    const match = matches.value[index.value + offset];
    return match ? entries.value[match.id] ?? empty : empty;
  }
  async function ensure(id: string, force = false) {
    if (!force && entries.value[id]) return;
    const request = Symbol(id);
    const epoch = generation;
    requests.set(id, request);
    entries.value = { ...entries.value, [id]: { detail: entries.value[id]?.detail ?? null, loading: true, error: false } };
    try {
      const detail = await fetchDetail(id);
      if (detail.match.id !== id) throw new Error('比赛详情不匹配');
      if (disposed || epoch !== generation || requests.get(id) !== request) return;
      entries.value = { ...entries.value, [id]: { detail, loading: false, error: false } };
    } catch {
      if (disposed || epoch !== generation || requests.get(id) !== request) return;
      entries.value = { ...entries.value, [id]: { detail: null, loading: false, error: true } };
    }
  }
  watch([matches, index], ([list], old) => {
    if (list !== old?.[0]) {
      generation += 1;
      entries.value = {};
      requests.clear();
    }
    const ids = [list[index.value], list[index.value + 1], list[index.value - 1]].filter(Boolean).map(item => item!.id);
    entries.value = Object.fromEntries(Object.entries(entries.value).filter(([id]) => ids.includes(id)));
    for (const id of requests.keys()) if (!ids.includes(id)) requests.delete(id);
    for (const id of ids) void ensure(id);
  }, { immediate: true });
  onScopeDispose(() => { disposed = true; requests.clear(); });
  return {
    entries,
    active: computed(() => entryAt(0)),
    next: computed(() => entryAt(1)),
    previous: computed(() => entryAt(-1)),
    reload: () => {
      const match = matches.value[index.value];
      if (match) return ensure(match.id, true);
    },
  };
}
