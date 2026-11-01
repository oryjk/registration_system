import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';

// Run after the MP production build, so the platform guards are exercised.
test('WeChat starts in mint without restoring an old theme or exposing a theme switch', () => {
  const palettes = {};
  runInNewContext(readFileSync(resolve('dist/build/mp-weixin/config/themePalettes.js'), 'utf8'), { exports: palettes });
  const store = {};
  let storageReads = 0;
  let storageWrites = 0;
  runInNewContext(readFileSync(resolve('dist/build/mp-weixin/stores/theme.js'), 'utf8'), {
    exports: store,
    require: name => name.includes('vendor') ? {
      ref: value => ({ value }),
      computed: getter => ({ get value() { return getter(); } }),
    } : name.includes('themePalettes') ? palettes : {
      getStoredAccentTheme: () => { storageReads += 1; return 'night'; },
      setStoredAccentTheme: () => { storageWrites += 1; },
    },
  });
  const theme = store.useAccentTheme();
  expect(theme.accentTheme.value).toBe('mint');
  expect(theme.accentHex.value).toBe(palettes.ACCENT_THEMES.mint.accent);
  expect(theme.themePageStyle.value).toBe(palettes.buildAccentThemePageStyle('mint'));
  expect(theme.setAccentTheme).toBeUndefined();
  expect(storageReads).toBe(0);
  expect(storageWrites).toBe(0);
});

test('WeChat personal center does not register the theme picker', () => {
  const page = JSON.parse(readFileSync(resolve('dist/build/mp-weixin/pages/user/index.json'), 'utf8'));
  expect(Object.keys(page.usingComponents ?? {}).some(key => key.includes('theme-accent-picker'))).toBe(false);
});
