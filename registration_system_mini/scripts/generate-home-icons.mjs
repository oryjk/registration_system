// Build the homepage's small, native-image icon set from the installed Lucide originals.
// Requires the admin workspace's existing Playwright and lucide-react dev dependencies.
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../registration_system_backend_fe_go/node_modules/playwright/index.mjs';

const output = new URL('../src/static/home-icons/', import.meta.url);
const source = new URL('../../registration_system_backend_fe_go/node_modules/lucide-react/dist/esm/icons/', import.meta.url);
const icons = [
  ['calendar-days', 'calendar-days', '#65758b'],
  ['chevron-right', 'chevron-right', '#7a8899'],
  ['chevron-left', 'chevron-left', '#7a8899'],
  ['chevron-down', 'chevron-down', '#65758b'],
  ['circle-check', 'circle-check', '#16b979'],
  ['home', 'house', '#8c96a5'],
  ['home-active', 'house', '#00cfb3'],
  ['football', null, '#8c96a5'],
  ['stats', 'chart-no-axes-column', '#8c96a5'],
  ['user', 'user-round', '#8c96a5'],
];
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
try {
  const page = await browser.newPage({ viewport: { width: 72, height: 72 }, deviceScaleFactor: 1 });
  for (const [name, original, stroke] of icons) {
    const __iconNode = original ? (await import(new URL(`${original}.js`, source))).__iconNode : [
      ['circle', {cx:12, cy:12, r:9}],
      ['path', {d:'m12 7 4.5 3.5-1.8 5H9.3l-1.8-5L12 7Zm0 0V3m4.5 7.5 4.3-1.4m-6.1 6.4 2.8 3.7m-8.2-3.7-2.8 3.7m1-8.7L3.2 9.1'}],
    ];
    const shapes = __iconNode.map(([tag, attributes]) => {
      const attrs = Object.entries(attributes).filter(([key]) => key !== 'key').map(([key, value]) => `${key}="${value}"`).join(' ');
      return `<${tag} ${attrs}/>`;
    }).join('');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">${shapes}</svg>\n`;
    await writeFile(new URL(`${name}.svg`, output), svg);
    await page.setContent(`<style>html,body{margin:0;width:72px;height:72px;overflow:hidden}svg{display:block}</style>${svg}`);
    await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)), omitBackground: true });
  }
} finally {
  await browser.close();
}
console.log(`Generated ${icons.length} homepage icons (SVG + 72px PNG).`);
