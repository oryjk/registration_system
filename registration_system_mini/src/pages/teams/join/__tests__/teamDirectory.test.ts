import { describe, expect, test } from "bun:test";
import { ref } from "vue";
import type { BackendTeamSummary } from "@/types/backend";
import { useTeamDirectory } from "../useTeamDirectory";

const team = (id: number, name = `球队${id}`) => ({ id, name, member_count: 1 } as BackendTeamSummary);
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

describe("joinable team directory", () => {
  test("loads beyond 50 teams and filters live without making extra requests", async () => {
    const calls: number[] = [];
    const keyword = ref("");
    const directory = useTeamDirectory(keyword, async offset => {
      calls.push(offset);
      return offset === 0 ? Array.from({ length: 50 }, (_, i) => team(i + 1)) : [team(51, "洺悅 FC")];
    });
    await directory.load();
    expect(calls).toEqual([0, 50]);
    expect(directory.results.value.length).toEqual(51);
    keyword.value = "  洺悦 fc  ";
    expect(directory.results.value.map(item => item.id)).toEqual([51]);
    keyword.value = "";
    expect(directory.results.value.length).toEqual(51);
    expect(calls).toEqual([0, 50]);
  });

  test("deduplicates concurrent loads and avoids reloading on repeated page shows", async () => {
    const pending = deferred<BackendTeamSummary[]>();
    let calls = 0;
    const directory = useTeamDirectory(ref(""), () => { calls++; return pending.promise; });
    const first = directory.load(); const second = directory.load();
    pending.resolve([team(1)]);
    await Promise.all([first, second]); await directory.load();
    expect(calls).toEqual(1);
  });

  test("an empty directory is a completed result", async () => {
    const directory = useTeamDirectory(ref(""), async () => []);
    await directory.load();
    expect(directory.loaded.value).toEqual(true);
    expect(directory.results.value).toEqual([]);
    expect(directory.error.value).toEqual("");
  });

  test("failed loads can retry, and refresh retains the input filter", async () => {
    let fail = true;
    const keyword = ref("新");
    const directory = useTeamDirectory(keyword, async () => {
      if (fail) throw new Error("网络不可用");
      return [team(1, "新球队"), team(2, "旧球队")];
    });
    await directory.load();
    expect(directory.loaded.value).toEqual(false);
    expect(directory.error.value).toEqual("网络不可用");
    fail = false; await directory.load(true);
    expect(directory.error.value).toEqual("");
    expect(directory.results.value.map(item => item.id)).toEqual([1]);
    expect(keyword.value).toEqual("新");
  });

  test("reset ignores a stale response and permits a fresh request", async () => {
    const old = deferred<BackendTeamSummary[]>();
    let calls = 0;
    const directory = useTeamDirectory(ref(""), () => ++calls === 1 ? old.promise : Promise.resolve([team(2)]));
    const pending = directory.load();
    directory.reset(); await directory.load();
    old.resolve([team(1)]); await pending;
    expect(directory.results.value.map(item => item.id)).toEqual([2]);
    expect(directory.loading.value).toEqual(false);
  });

  test("a synchronous request failure can also retry", async () => {
    let fail = true;
    const directory = useTeamDirectory(ref(""), () => {
      if (fail) throw new Error("request setup failed");
      return Promise.resolve([team(1)]);
    });
    await directory.load(); fail = false; await directory.load();
    expect(directory.loaded.value).toEqual(true);
    expect(directory.results.value.map(item => item.id)).toEqual([1]);
  });

  test("a server ignoring offsets cannot produce an infinite paging loop", async () => {
    let calls = 0;
    const directory = useTeamDirectory(ref(""), async () => { calls++; return Array.from({ length: 50 }, (_, i) => team(i)); });
    await directory.load();
    expect(calls).toEqual(2);
    expect(directory.loaded.value).toEqual(false);
    expect(directory.error.value.length > 0).toEqual(true);
  });
});
