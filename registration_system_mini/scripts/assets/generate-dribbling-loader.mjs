/**
 * Rebuild the transparent, 16-frame dribbling sprite (no runtime JS/timers).
 * Run: node scripts/assets/generate-dribbling-loader.mjs /path/to/sharp/lib/index.js
 * SVG is the editable vector source; PNG is used for consistent WeChat rendering.
 */
import { writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

// PNG 进包（static 会被整体拷入小程序包，注意 2MB 主包上限，必要时做调色板量化）；
// SVG 是可编辑矢量源，只留在脚本目录，不打进包里。
const output = new URL('../../src/static/illustrations/', import.meta.url);
const svgSource = new URL('./', import.meta.url);
const count = 16;
const width = 320;
const height = 240;
const ink = '#18251e';
const skin = '#e9b68f';
const green = '#b9f24b';
const point = ([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`;
const path = (d, fill, extra = '') => `<path d="${d}" fill="${fill}" ${extra}/>`;
const line = (points, color, weight) => path(`M${points.map(point).join(' L')}`, 'none', `stroke="${color}" stroke-width="${weight}" stroke-linecap="round" stroke-linejoin="round"`);
const ellipse = (x, y, rx, ry, color, extra = '') => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${color}" ${extra}/>`;

function leg(phase, hip, far) {
  // Each foot is planted for only 32% of the cycle. With the legs half a
  // cycle apart this leaves two airborne phases, unlike the old walking gait.
  // A low recovery arc keeps the legs open for a controlled dribble instead
  // of folding the heel into the shorts like an exaggerated sprint.
  const poses = [[0, 184, 202], [0.32, 122, 202], [0.48, 123, 192],
    [0.67, 150, 190], [0.85, 180, 194], [1, 184, 202]];
  const next = poses.findIndex(pose => pose[0] > phase);
  const start = poses[next - 1], end = poses[next];
  const progress = (phase - start[0]) / (end[0] - start[0]);
  const x = start[1] + (end[1] - start[1]) * progress;
  const y = start[2] + (end[2] - start[2]) * progress;
  const bootAngle = phase < 0.32 ? 0 : 18 * Math.sin((phase - 0.32) / 0.68 * Math.PI * 2);
  const dx = x - hip[0], dy = y - hip[1];
  const distance = Math.hypot(dx, dy);
  const bend = Math.sqrt(Math.max(0, 38 ** 2 - (distance / 2) ** 2));
  const knee = [hip[0] + dx / 2 + dy / distance * bend, hip[1] + dy / 2 - dx / distance * bend];
  const ankle = [x, y];
  const sock = [knee[0] * 0.42 + x * 0.58, knee[1] * 0.42 + y * 0.58];
  return `<g ${far ? 'opacity="0.8"' : ''}>`
    + line([hip, knee, ankle], ink, 14)
    + line([hip, knee, ankle], far ? '#ca9574' : skin, 9)
    + line([hip, [hip[0] * 0.5 + knee[0] * 0.5, hip[1] * 0.5 + knee[1] * 0.5]], ink, 18)
    + line([sock, ankle], '#fffdf8', 10)
    + line([[sock[0], sock[1] + 3], [sock[0] + (x - sock[0]) * 0.2, sock[1] + 6]], green, 10)
    + `<g transform="rotate(${bootAngle} ${x} ${y})">`
    + path(`M${x - 5},${y - 3} Q${x + 1},${y - 5} ${x + 7},${y} L${x + 17},${y + 4} Q${x + 21},${y + 9} ${x + 15},${y + 10} L${x - 6},${y + 10} Z`, ink)
    + line([[x - 3, y + 8], [x + 15, y + 8]], '#fffdf8', 2)
    + '</g></g>';
}

function arm(phase, far) {
  const shoulder = [153, 107];
  const angle = Math.cos(phase * Math.PI * 2) * 0.85;
  const elbow = [shoulder[0] - Math.sin(angle) * 27, shoulder[1] + Math.cos(angle) * 27];
  const hand = [elbow[0] + 23, elbow[1] - 15];
  return line([shoulder, elbow, hand], ink, 12)
    + line([shoulder, elbow, hand], far ? '#ca9574' : skin, 8)
    + line([shoulder, [shoulder[0] * 0.58 + elbow[0] * 0.42, shoulder[1] * 0.58 + elbow[1] * 0.42]], far ? '#92bd3e' : green, 14);
}

function frame(index) {
  const t = index / count;
  const bob = -2 + 3 * Math.cos((t - 0.15) * Math.PI * 4);
  const hip = [153, 140 + bob];
  // Bring the pelvis under the ribcage. The silhouette already leans forward;
  // only a small extra tilt is needed, with a level waistband and no hip hinge.
  const upperBody = `<g transform="translate(8 ${bob - 7}) rotate(4 145 147)">`;
  const ballX = 216 + 18 * Math.sin(Math.PI * t);
  const ballY = 200 - 2 * Math.sin(Math.PI * t);
  let drawing = ellipse(146, 216, 57, 4, ink, 'opacity="0.08"');
  drawing += ellipse(ballX, 215, 13, 3, ink, 'opacity="0.12"');
  drawing += line([[61, 216], [266, 216]], '#cbd3c6', 1.5);
  for (let n = 0; n < 4; n++) {
    const x = 66 + ((n * 51 + 204 - t * 51) % 204);
    drawing += line([[x, 223], [x + 9, 223]], '#cbd3c6', 2);
  }
  drawing += upperBody + arm((t + 0.5) % 1, true) + '</g>';
  drawing += leg((t + 0.5) % 1, hip, true);
  drawing += leg(t, hip, false);
  drawing += upperBody;
  drawing += line([[158, 96], [166, 83]], ink, 14) + line([[158, 96], [166, 83]], skin, 10);
  drawing += path('M147 94 Q157 92 166 100 L173 111 L161 118 L158 140 Q145 142 133 139 L136 110 Z', green, `stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"`);
  drawing += path('M133 137 Q145 140 158 138 L157 150 Q145 153 133 149 Z', ink);
  drawing += path('M148 96 Q155 104 163 100', 'none', `stroke="${ink}" stroke-width="3"`);
  drawing += path('M143 110 L154 113 L144 128', 'none', `stroke="${ink}" stroke-width="3.5" stroke-linejoin="round"`);
  drawing += path('M159 58 Q169 49 181 59 Q187 65 184 73 L188 78 L183 80 Q181 91 173 91 L159 83 Q153 72 159 58 Z', skin, `stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"`);
  drawing += path('M156 74 Q149 62 158 55 Q160 48 172 51 Q182 48 187 59 L183 66 L170 62 L166 73 L162 70 L160 79 Z', ink);
  drawing += ellipse(164, 76, 3.5, 4.5, skin);
  drawing += ellipse(180, 72, 1.5, 1.5, ink);
  drawing += line([[179, 84], [183, 83]], ink, 1.5);
  drawing += arm(t, false) + '</g>';
  // A small, grounded football, rotating one full turn per seamless cycle.
  drawing += `<g transform="translate(${ballX} ${ballY}) rotate(${t * 360})">`;
  drawing += ellipse(0, 0, 13, 13, '#fffdf8', `stroke="${ink}" stroke-width="2"`);
  drawing += path('M0 -5 L5 -1 L3 5 L-3 5 L-5 -1 Z', ink);
  for (let n = 0; n < 5; n++) {
    drawing += `<g transform="rotate(${n * 72})">` + line([[0, -5], [0, -10]], ink, 1)
      + path('M-4 -12 L0 -9 L4 -12 Q0 -14 -4 -12', ink) + '</g>';
  }
  return drawing + '</g>';
}

const frames = Array.from({ length: count }, (_, index) => `<g transform="translate(${(index % 4) * width} ${Math.floor(index / 4) * height})">${frame(index)}</g>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width * 4}" height="${height * 4}" viewBox="0 0 ${width * 4} ${height * 4}">${frames}</svg>`;
await writeFile(new URL('dribbling-sprite.svg', svgSource), svg);
const sharpModule = process.argv[2] ? pathToFileURL(process.argv[2]).href : 'sharp';
const { default: sharp } = await import(sharpModule);
await sharp(Buffer.from(svg), { density: 144 }).png().toFile(fileURLToPath(new URL('dribbling-sprite.png', output)));
console.log('Generated 16 dribbling frames at 2× resolution.');
