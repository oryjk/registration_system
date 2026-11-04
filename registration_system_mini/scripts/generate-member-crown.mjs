// Build the paid-member crown badge (metallic gold, native 1.8:1 ratio) used by MembershipCrown and the honor poster canvas.
// Requires the admin workspace's existing Playwright dev dependency, same as generate-home-icons.mjs.
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from '../../registration_system_backend_fe_go/node_modules/playwright/index.mjs';

const output = new URL('../src/static/icons/', import.meta.url);
const WIDTH = 216;
const HEIGHT = 120;

// Decorative asset colors (gold metal, ruby, pearl) are part of the illustration, not UI tokens.
const crownPath = 'M10 80 L4 30 Q4 26 8 28 L48 54 L86 10 Q90 5 94 10 L132 54 L172 28 Q176 26 176 30 L170 80 Z';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 198 110">
  <defs>
    <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff1b0"/>
      <stop offset="0.38" stop-color="#ffd24d"/>
      <stop offset="0.72" stop-color="#f2a91c"/>
      <stop offset="1" stop-color="#c97a06"/>
    </linearGradient>
    <linearGradient id="band" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffd859"/>
      <stop offset="0.55" stop-color="#e99a12"/>
      <stop offset="1" stop-color="#b86a04"/>
    </linearGradient>
    <linearGradient id="shine" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.85"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="pearl" cx="0.35" cy="0.3" r="0.75">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="0.45" stop-color="#ffe9a3"/>
      <stop offset="1" stop-color="#e09a14"/>
    </radialGradient>
    <radialGradient id="ruby" cx="0.35" cy="0.3" r="0.8">
      <stop offset="0" stop-color="#ffb3bd"/>
      <stop offset="0.45" stop-color="#ef3b55"/>
      <stop offset="1" stop-color="#9e1028"/>
    </radialGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#5a3a00" flood-opacity="0.32"/>
    </filter>
  </defs>
  <g transform="translate(9 9)" filter="url(#shadow)">
    <!-- 白色外描边：叠在头像照片上时保持轮廓清晰。 -->
    <g stroke="#ffffff" stroke-width="9" stroke-linejoin="round" fill="#ffffff">
      <path d="${crownPath}"/>
      <rect x="8" y="74" width="164" height="18" rx="7"/>
      <circle cx="6" cy="27" r="8"/><circle cx="90" cy="6" r="9"/><circle cx="174" cy="27" r="8"/>
    </g>
    <path d="${crownPath}" fill="url(#metal)" stroke="#b8730a" stroke-width="2.5" stroke-linejoin="round"/>
    <path d="M14 74 L9 36 L46 60 L86 16 L60 58 L22 44 L24 74 Z" fill="url(#shine)" opacity="0.55"/>
    <rect x="8" y="74" width="164" height="18" rx="7" fill="url(#band)" stroke="#a9650a" stroke-width="2.5"/>
    <rect x="16" y="77" width="148" height="4" rx="2" fill="#ffffff" opacity="0.45"/>
    <circle cx="6" cy="27" r="8" fill="url(#pearl)" stroke="#b8730a" stroke-width="2"/>
    <circle cx="90" cy="6" r="9" fill="url(#pearl)" stroke="#b8730a" stroke-width="2"/>
    <circle cx="174" cy="27" r="8" fill="url(#pearl)" stroke="#b8730a" stroke-width="2"/>
    <path d="M90 74 L99 83 L90 92 L81 83 Z" fill="url(#ruby)" stroke="#7d0a1e" stroke-width="1.5" transform="translate(0 -21)"/>
    <circle cx="48" cy="83" r="4.5" fill="url(#pearl)"/>
    <circle cx="132" cy="83" r="4.5" fill="url(#pearl)"/>
  </g>
</svg>
`;

await writeFile(new URL('member-crown-gold.svg', output), svg);
const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH });
try {
  const page = await browser.newPage({ viewport: { width: WIDTH, height: HEIGHT }, deviceScaleFactor: 1 });
  await page.setContent(`<style>html,body{margin:0;width:${WIDTH}px;height:${HEIGHT}px;overflow:hidden;background:transparent}svg{display:block}</style>${svg}`);
  await page.screenshot({ path: fileURLToPath(new URL('member-crown-gold.png', output)), omitBackground: true });
} finally {
  await browser.close();
}
