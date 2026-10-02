export {};
// 模块 mock 在 Bun 的同一进程共享，隔离编辑链路，避免污染其他页面测试。
if (!(globalThis as any).process.env.MINI_TIMEZONE_EDIT_CASES) {
  const { test, expect }: any = await import("bun:test");
  test("match edit timezone round-trip in an isolated module context", () => {
    const runtime = (globalThis as any).Bun;
    const proc = (globalThis as any).process;
    const result = runtime.spawnSync({
      cmd: [proc.execPath, "test", decodeURIComponent(new URL(import.meta.url).pathname)],
      env: { ...proc.env, MINI_TIMEZONE_EDIT_CASES: "1" }, stdout: "pipe", stderr: "pipe",
    });
    if (result.exitCode !== 0) throw new Error(result.stderr.toString());
    expect(result.exitCode).toEqual(0);
  });
} else {
  const { test, expect, mock }: any = await import("bun:test");
  const { ref } = await import("vue");
  const { formatFullDateTimeLabel, mergeBeijingDate, mergeBeijingTime } = await import("@/utils/datetime");
  const requests: any[] = [];
  mock.module("@/api/match", () => ({ updateMyMatch: async (id: string, payload: unknown) => requests.push({ id, payload }) }));
  (globalThis as any).uni = { showToast: () => {}, $emit: () => {} };
  const { useMatchEdit } = await import("../useMatchEdit");
  function setup(start: string, end: string) {
    return useMatchEdit({
      sourceMatch: ref({ id: "edit-match", name: "友谊赛", location: "球场", publication_mode: "offline_confirmed",
        opponent_state: "no_recruitment", opponent_name: "客队", players_per_team: 8, start_time: start, end_time: end } as any),
      matchTeamGroups: ref([]), reload: async () => {},
    });
  }
  test("editing a legacy UTC timestamp keeps Beijing picker values and submits UTC once", async () => {
    requests.length = 0;
    const edit = setup("2030-12-31 12:00:00", "2030-12-31 14:00:00");
    edit.open();
    expect(formatFullDateTimeLabel(edit.startTime.value)).toEqual("2030-12-31 20:00");
    edit.startTime.value = mergeBeijingTime(mergeBeijingDate(edit.startTime.value, "2031-01-01"), "21:00");
    edit.endTime.value = mergeBeijingTime(mergeBeijingDate(edit.endTime.value, "2031-01-01"), "23:00");
    await edit.submit();
    expect(requests[0].payload.start_time).toEqual("2031-01-01T13:00:00.000Z");
    expect(requests[0].payload.end_time).toEqual("2031-01-01T15:00:00.000Z");
  });
  test("past-time confirmation displays the Beijing clock", async () => {
    const edit = setup("2020-12-31T16:30:00Z", "2020-12-31T18:30:00Z");
    edit.open();
    await edit.submit();
    expect(edit.pastTimeMessage.value.includes("2021-01-01 00:30")).toEqual(true);
    expect(edit.pastTimeDialogVisible.value).toEqual(true);
  });
}
