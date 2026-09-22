import { describe, expect, test } from 'bun:test';
import { createPageRefresh } from '../pageRefresh';

describe('page refresh lifecycle', () => {
  test('coalesces overlapping gestures and waits for data before stopping', async () => {
    let resolve!: () => void;
    const loading = new Promise<void>(done => { resolve = done; });
    let loads = 0;
    let stops = 0;
    const refresh = createPageRefresh(() => { loads++; return loading; }, () => { stops++; }, () => {});
    const first = refresh();
    expect(refresh() === first).toEqual(true);
    await Promise.resolve();
    expect(loads).toEqual(1);
    expect(stops).toEqual(0);
    resolve();
    await first;
    expect(stops).toEqual(1);
    await refresh();
    expect(loads).toEqual(2);
  });
  test('reports failure, stops the indicator and allows retry', async () => {
    let attempts = 0;
    let stops = 0;
    const errors: unknown[] = [];
    const refresh = createPageRefresh(() => { if (++attempts === 1) throw new Error('offline'); }, () => { stops++; }, e => { errors.push(e); });
    await refresh();
    await refresh();
    expect(attempts).toEqual(2);
    expect(stops).toEqual(2);
    expect(errors.length).toEqual(1);
  });
});
