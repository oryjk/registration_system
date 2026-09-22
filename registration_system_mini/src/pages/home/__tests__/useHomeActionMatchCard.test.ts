import { describe, expect, test } from "bun:test";
import { effectScope, nextTick, ref } from "vue";
import type { HomeMatchCardViewModel } from "@/types/viewModels";
import type { AppMatchDetailResponse } from "@/types/match";
import { useHomeActionMatchCard } from "../useHomeActionMatchCard";

function deferred() {
  let resolve!: (value: AppMatchDetailResponse) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<AppMatchDetailResponse>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const summary = (id: string) => ({ id } as HomeMatchCardViewModel);
const response = (id: string) => ({ match: { id }, groups: [] } as unknown as AppMatchDetailResponse);

describe("now card detail loading", () => {
  test("late responses cannot overwrite the new selected match", async () => {
    const first = deferred(); const second = deferred();
    const selected = ref<HomeMatchCardViewModel | null>(summary("one"));
    const scope = effectScope();
    const state = scope.run(() => useHomeActionMatchCard(selected, (id) => id === "one" ? first.promise : second.promise))!;
    selected.value = summary("two"); await nextTick();
    second.resolve(response("two")); await nextTick();
    first.resolve(response("one")); await nextTick();
    expect(state.detail.value?.match.id).toEqual("two");
    expect(state.loading.value).toEqual(false);
    scope.stop();
  });
  test("failure permits retry and missing selection clears all detail", async () => {
    const selected = ref<HomeMatchCardViewModel | null>(summary("one"));
    let calls = 0;
    const scope = effectScope();
    const state = scope.run(() => useHomeActionMatchCard(selected, async () => {
      if (++calls === 1) throw new Error("offline");
      return response("one");
    }))!;
    await nextTick();
    expect(state.error.value).toEqual(true);
    await state.reload();
    expect(state.error.value).toEqual(false);
    expect(state.detail.value?.match.id).toEqual("one");
    selected.value = null; await nextTick();
    expect(state.detail.value).toEqual(null);
    expect(state.loading.value).toEqual(false);
    expect(calls).toEqual(2);
    scope.stop();
  });
  test("disposed pages ignore outstanding responses", async () => {
    const request = deferred(); const scope = effectScope();
    const state = scope.run(() => useHomeActionMatchCard(ref(summary("one")), () => request.promise))!;
    scope.stop(); request.resolve(response("one")); await nextTick();
    expect(state.detail.value).toEqual(null);
  });
});
