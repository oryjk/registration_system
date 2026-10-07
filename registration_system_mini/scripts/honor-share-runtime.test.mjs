import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

// Run after a production MP build. Exercise the compiled page declaration:
// composable-only hooks are invisible to uni's native page hook detector.
test('compiled honor page registers native friend and timeline share hooks', () => {
 let page;
 const registered = {};
 const code = 'abcdefghijklmnopqrstuv';
 const vendor = {
  defineComponent: value => value,
  _export_sfc: value => value,
  getCurrentInstance: () => ({ proxy: {} }),
  computed: fn => ({ value: fn() }),
  onShareAppMessage: fn => { registered.friend = fn; },
  onShareTimeline: fn => { registered.timeline = fn; },
 };
 runInNewContext(readFileSync(resolve('dist/build/mp-weixin/pages/honors/index.js'), 'utf8'), {
  wx: { createPage: value => { page = value; } },
  require: name => name.includes('vendor') ? vendor : name.includes('theme') ? {
   useAccentTheme: () => ({ themePageStyle: {} }),
  } : name.includes('customNav') ? { getCustomNavMetrics: () => ({ pageTopPadding: 0 }) } : {
   useHonorPage: () => ({
    friendShare: () => ({ path: '/pages/honors/index?code=' + code }),
    timelineShare: () => ({ query: 'code=' + code }),
   }),
  },
 });
 // Native uni runtime only installs these methods when the compiler sets flags.
 expect((page.__runtimeHooks ?? 0) & 2).toBe(2);
 expect((page.__runtimeHooks ?? 0) & 4).toBe(4);
 page.setup({});
 expect(registered.friend().path).toBe('/pages/honors/index?code=' + code);
 expect(registered.timeline().query).toBe('code=' + code);
});
