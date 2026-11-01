import { computed, getCurrentScope, onScopeDispose, ref, type Ref } from "vue";
import type { BackendTeamSummary } from "@/types/backend";

// The existing search endpoint keeps its 50-row page size for older clients.
const TEAM_SEARCH_PAGE_SIZE = 50;
const normalizeName = (value: string) => value.trim().replace(/悅/g, "悦").toLowerCase();

export function useTeamDirectory(keyword: Ref<string>, fetchPage: (offset: number) => Promise<BackendTeamSummary[]>) {
  const teams = ref<BackendTeamSummary[]>([]);
  const loaded = ref(false);
  const loading = ref(false);
  const error = ref("");
  let version = 0;
  let pending: Promise<void> | undefined;
  const results = computed(() => {
    const query = normalizeName(keyword.value);
    return query ? teams.value.filter(team => normalizeName(team.name).includes(query)) : teams.value;
  });

  function reset() {
    version++;
    pending = undefined;
    teams.value = [];
    loaded.value = false;
    loading.value = false;
    error.value = "";
  }

  function load(force = false): Promise<void> {
    if (pending) return pending;
    if (loaded.value && !force) return Promise.resolve();
    const current = ++version;
    loading.value = true;
    error.value = "";
    pending = (async () => {
      try {
        const all = new Map<number, BackendTeamSummary>();
        for (let offset = 0; ; offset += TEAM_SEARCH_PAGE_SIZE) {
          const batch = await Promise.resolve().then(() => fetchPage(offset));
          if (current !== version) return;
          const previousSize = all.size;
          for (const item of batch) all.set(item.id, item);
          if (batch.length && all.size === previousSize) throw new Error("球队列表加载异常，请稍后重试");
          if (batch.length < TEAM_SEARCH_PAGE_SIZE) break;
        }
        teams.value = [...all.values()];
        loaded.value = true;
      } catch (cause) {
        if (current === version) error.value = cause instanceof Error ? cause.message : "球队列表加载失败，请重试";
      } finally {
        if (current === version) { loading.value = false; pending = undefined; }
      }
    })();
    return pending;
  }

  if (getCurrentScope()) onScopeDispose(reset);
  return { results, loaded, loading, error, load, reset };
}
