import {
  MATCH_SHARE_CARD_HEIGHT,
  MATCH_SHARE_CARD_WIDTH,
  createMatchShareImageLoader,
  fitText,
  truncateText,
  type MatchShareCanvasImage,
  type ShareCardImageInfo,
} from "./matchShareCardCompose";
import {
  drawRegistrationAvatarStack,
  resolveAvatarInitial,
  type LoadedShareAvatar,
  type MatchShareAvatarItem,
} from "./matchShareCardRegistration";

export const HOME_SHARE_CARD_WIDTH = MATCH_SHARE_CARD_WIDTH;
export const HOME_SHARE_CARD_HEIGHT = MATCH_SHARE_CARD_HEIGHT;
export const HOME_SHARE_CARD_CANVAS_ID = "home-share-card-canvas";
export const MAX_HOME_SHARE_AVATARS = 10;

export interface HomeShareNextMatchInput {
  title: string;
  dateLabel?: string;
  venue?: string;
  joinedPlayers: number;
  requiredPlayers?: number;
  avatars: MatchShareAvatarItem[];
}

export interface HomeShareCardInput {
  /** 分享人昵称（当前登录用户昵称，游客为空） */
  inviterName?: string;
  /** 当前球队名称 */
  teamName?: string;
  /** 当前球队队徽 URL */
  teamLogoUrl?: string;
  /** 球队在队人数 */
  teamMemberCount?: number;
  /** 球队信誉分 */
  teamCreditScore?: number;
  /** 近期待开踢场次数 */
  upcomingMatchCount?: number;
  /** 首页下一场焦点比赛 */
  nextMatch?: HomeShareNextMatchInput | null;
}

export type HomeShareCardMode = "team-next-match" | "team-idle" | "brand";

export interface HomeShareCardViewModel {
  mode: HomeShareCardMode;
  ribbonText: string;
  teamName: string;
  teamLogoUrl: string;
  teamInitial: string;
  memberPillText: string;
  schedulePillText: string;
  creditBadgeText: string;
  nextMatchKicker: string;
  nextMatchHeadline: string;
  nextMatchJoinedLabel: string;
  nextMatchJoinedCount: number;
  nextMatchAvatars: MatchShareAvatarItem[];
  footerText: string;
}

interface HomeCanvasImage extends MatchShareCanvasImage {
  src: string;
  onload: (() => void) | null;
  onerror: ((err?: unknown) => void) | null;
}

interface Canvas2DNode {
  width: number;
  height: number;
  getContext(type: "2d"): CanvasRenderingContext2D;
  createImage(): HomeCanvasImage;
  toTempFilePath?(options: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    destWidth?: number;
    destHeight?: number;
    fileType?: "jpg" | "png";
    quality?: number;
    success?: (res: { tempFilePath: string }) => void;
    fail?: (err: unknown) => void;
  }): void;
}

function cleanText(value?: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

/** 生成更有社交背书与传播性的首页动态分享标题。 */
export function buildHomeShareTitle(input: HomeShareCardInput): string {
  const inviter = truncateText(cleanText(input.inviterName), 10);
  const team = truncateText(cleanText(input.teamName), 12);
  const hasNextMatch = Boolean(input.nextMatch && cleanText(input.nextMatch.title));

  if (team && hasNextMatch) {
    return inviter
      ? `${inviter}邀你踢球：${team}即将开踢，等你上场！`
      : `${team}即将开踢！来一起组队报名上场`;
  }
  if (team) {
    return inviter
      ? `${inviter}邀你一起踢球 · ${team}`
      : `${team}邀你一起踢球：组队、报名、排阵一站搞定`;
  }
  if (inviter) {
    return `${inviter}邀你约球开踢：找球局、组球队、排阵型`;
  }
  return "周末去哪踢？组队、报名、排阵型，拉上球友直接开踢！";
}

/** 构造首页分享卡（方案 A：球队召集令）的渲染视图模型。 */
export function buildHomeShareCardViewModel(input: HomeShareCardInput): HomeShareCardViewModel {
  const inviter = truncateText(cleanText(input.inviterName), 10);
  const teamName = cleanText(input.teamName);
  const teamLogoUrl = cleanText(input.teamLogoUrl);
  const memberCount = Math.max(0, Math.floor(Number(input.teamMemberCount) || 0));
  const creditScore = Math.max(0, Math.floor(Number(input.teamCreditScore) || 0));
  const upcomingCount = Math.max(0, Math.floor(Number(input.upcomingMatchCount) || 0));
  const next = input.nextMatch && cleanText(input.nextMatch.title) ? input.nextMatch : null;

  const mode: HomeShareCardMode = teamName
    ? (next ? "team-next-match" : "team-idle")
    : "brand";

  const ribbonText = mode === "brand"
    ? (inviter ? `${inviter} · 邀你一起约球开踢` : "约球开踢 · 你的球友都在这")
    : (inviter ? `${inviter} · 邀你一起上场踢球` : "球队召集令 · 邀你一起上场踢球");

  const memberPillText = memberCount > 0 ? `${memberCount} 位球友在队` : "欢迎球友加入";
  const schedulePillText = upcomingCount > 0
    ? `近期 ${upcomingCount} 场约战待踢`
    : "随时开踢 · 等你上场";
  const creditBadgeText = creditScore > 0 ? `信誉 ${creditScore}分` : "";

  const nextDate = cleanText(next?.dateLabel);
  const nextTitle = cleanText(next?.title);
  const nextVenue = cleanText(next?.venue);
  const nextMatchKicker = nextDate ? `下场开踢 · ${nextDate}` : "下场约战 · 报名中";
  const nextMatchHeadline = [nextTitle, nextVenue].filter(Boolean).join(" · ") || "精彩约战等你上场";
  const nextMatchJoinedCount = Math.max(0, Math.floor(Number(next?.joinedPlayers) || 0));
  const nextMatchJoinedLabel = nextMatchJoinedCount > 0
    ? `已报 ${nextMatchJoinedCount} 人`
    : "火热报名中";
  const nextMatchAvatars = (next?.avatars ?? []).slice(0, MAX_HOME_SHARE_AVATARS);

  const footerText = mode === "team-next-match"
    ? "点击加入球局 · 一键报名 / 排阵 / 约队"
    : mode === "team-idle"
      ? "点击进入球队 · 找球局 / 排阵 / 约队"
      : "点击开启绿茵之旅 · 找球队 / 找球局";

  return {
    mode,
    ribbonText,
    teamName: teamName || "约球开踢",
    teamLogoUrl,
    teamInitial: resolveAvatarInitial(teamName || "球"),
    memberPillText,
    schedulePillText,
    creditBadgeText,
    nextMatchKicker,
    nextMatchHeadline,
    nextMatchJoinedLabel,
    nextMatchJoinedCount,
    nextMatchAvatars,
    footerText,
  };
}

/** 仅收集首页分享卡渲染所需的队徽与前 10 位队友头像去重 URL。 */
export function collectHomeShareImageUrls(view: HomeShareCardViewModel): string[] {
  const urls: string[] = [];
  if (view.teamLogoUrl) urls.push(view.teamLogoUrl);
  if (view.mode === "team-next-match") {
    for (const item of view.nextMatchAvatars.slice(0, MAX_HOME_SHARE_AVATARS)) {
      const url = cleanText(item.avatarUrl);
      if (url) urls.push(url);
    }
  }
  return Array.from(new Set(urls));
}

function queryCanvas2DNode(canvasId: string, pageInstance: unknown): Promise<Canvas2DNode> {
  return new Promise((resolve, reject) => {
    const query = pageInstance
      ? uni.createSelectorQuery().in(pageInstance)
      : uni.createSelectorQuery();
    query
      .select(`#${canvasId}`)
      .fields({ node: true, size: true }, () => undefined)
      .exec((res: Array<{ node?: Canvas2DNode } | null> | null) => {
        const node = res?.[0]?.node;
        if (!node || typeof node.getContext !== "function") {
          reject(new Error("未获取到首页分享卡 Canvas 2D 节点"));
          return;
        }
        resolve(node);
      });
  });
}

function loadCanvas2DImage(canvas: Canvas2DNode, src: string): Promise<MatchShareCanvasImage> {
  return new Promise((resolve, reject) => {
    const image = canvas.createImage();
    image.onload = () => resolve(image);
    image.onerror = (err) => reject(err ?? new Error("首页分享卡图片加载失败"));
    image.src = src;
  });
}

function getDefaultImageInfo(src: string): Promise<ShareCardImageInfo> {
  return new Promise((resolve, reject) => {
    uni.getImageInfo({
      src,
      success: (res) => resolve({ path: res.path, width: res.width || 0, height: res.height || 0 }),
      fail: (err) => reject(err),
    });
  });
}

function exportCanvas2DToTempFile(canvas: Canvas2DNode, isCurrent: () => boolean): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!isCurrent()) {
      reject(new Error("首页分享卡内容已更新"));
      return;
    }
    const exportOptions = {
      x: 0,
      y: 0,
      width: HOME_SHARE_CARD_WIDTH,
      height: HOME_SHARE_CARD_HEIGHT,
      destWidth: HOME_SHARE_CARD_WIDTH,
      destHeight: HOME_SHARE_CARD_HEIGHT,
      fileType: "jpg" as const,
      quality: 0.92,
      success: (res: { tempFilePath?: string }) => {
        if (!isCurrent()) {
          reject(new Error("首页分享卡内容已更新"));
          return;
        }
        if (res.tempFilePath) {
          resolve(res.tempFilePath);
          return;
        }
        reject(new Error("导出首页分享卡图片为空"));
      },
      fail: (err: unknown) => reject(err),
    };
    if (typeof canvas.toTempFilePath === "function") {
      canvas.toTempFilePath(exportOptions);
      return;
    }
    uni.canvasToTempFilePath({
      canvas: canvas as unknown,
      ...exportOptions,
    } as Parameters<typeof uni.canvasToTempFilePath>[0]);
  });
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = "left",
  weight: 600 | 700 | 800 | 900 = 800,
) {
  const roundedSize = Math.round(size);
  const bold = weight >= 700;
  ctx.save();
  ctx.font = `normal ${bold ? "bold" : "normal"} ${roundedSize}px sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  if (weight >= 800 && typeof ctx.strokeText === "function") {
    const ratio = weight >= 900 ? 0.036 : 0.022;
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.8, roundedSize * ratio);
    ctx.lineJoin = "round";
    ctx.strokeText(text, x, y);
  }
  ctx.fillText(text, x, y);
  ctx.restore();
}

function measureTextWidth(ctx: CanvasRenderingContext2D, text: string, size: number): number {
  const roundedSize = Math.round(size);
  ctx.save();
  ctx.font = `normal bold ${roundedSize}px sans-serif`;
  const w = ctx.measureText(text)?.width;
  ctx.restore();
  if (typeof w === "number" && Number.isFinite(w) && w > 0) return w * 1.04;
  return Array.from(text).length * roundedSize;
}

function drawFieryBackdrop(ctx: CanvasRenderingContext2D) {
  const w = HOME_SHARE_CARD_WIDTH;
  const h = HOME_SHARE_CARD_HEIGHT;
  ctx.save();
  if (typeof ctx.createRadialGradient === "function") {
    const bg = ctx.createRadialGradient(w * 0.5, h * 0.4, 40, w * 0.5, h * 0.5, w * 0.72);
    bg.addColorStop(0, "#4A1018");
    bg.addColorStop(0.55, "#22090F");
    bg.addColorStop(1, "#0D0407");
    ctx.fillStyle = bg;
  } else {
    const bg = ctx.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, "#4A1018");
    bg.addColorStop(1, "#0D0407");
    ctx.fillStyle = bg;
  }
  ctx.fillRect(0, 0, w, h);

  // 左右球场斜射光束
  const leftBeam = ctx.createLinearGradient(0, 0, 320, 620);
  leftBeam.addColorStop(0, "rgba(255, 86, 48, 0.28)");
  leftBeam.addColorStop(1, "rgba(255, 86, 48, 0)");
  ctx.fillStyle = leftBeam;
  ctx.beginPath();
  ctx.moveTo(40, 0);
  ctx.lineTo(280, 0);
  ctx.lineTo(440, 680);
  ctx.lineTo(140, 680);
  ctx.closePath();
  ctx.fill();

  const rightBeam = ctx.createLinearGradient(w, 0, 680, 620);
  rightBeam.addColorStop(0, "rgba(255, 45, 85, 0.24)");
  rightBeam.addColorStop(1, "rgba(255, 45, 85, 0)");
  ctx.fillStyle = rightBeam;
  ctx.beginPath();
  ctx.moveTo(740, 0);
  ctx.lineTo(960, 0);
  ctx.lineTo(820, 680);
  ctx.lineTo(580, 680);
  ctx.closePath();
  ctx.fill();

  // 背景大字暗纹
  ctx.font = "italic bold 118px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (typeof ctx.strokeText === "function") {
    ctx.strokeStyle = "rgba(255, 255, 255, 0.06)";
    ctx.lineWidth = 2;
    ctx.strokeText("KICK OFF", w / 2, 390);
  } else {
    ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
    ctx.fillText("KICK OFF", w / 2, 390);
  }
  ctx.restore();
}

function drawTopRibbon(ctx: CanvasRenderingContext2D, text: string) {
  ctx.save();
  ctx.fillStyle = "#FF453A";
  ctx.beginPath();
  ctx.moveTo(145, 22);
  ctx.lineTo(875, 22);
  ctx.lineTo(855, 86);
  ctx.lineTo(125, 86);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  const fitted = fitText(ctx, text, 680, 32, 22, 900);
  drawText(ctx, fitted.text, 500, 55, fitted.size, "#FFFFFF", "center", 900);
}

function drawWhiteActionFooter(ctx: CanvasRenderingContext2D, text: string) {
  const barY = 684;
  const barH = 116;
  ctx.save();
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, barY, HOME_SHARE_CARD_WIDTH, barH);
  ctx.fillStyle = "#FF453A";
  ctx.fillRect(0, barY, 18, barH);
  ctx.restore();

  const fitted = fitText(ctx, text, 830, 32, 24, 900);
  const textW = measureTextWidth(ctx, fitted.text, fitted.size);
  const iconGap = 44;
  const startX = Math.max(54, HOME_SHARE_CARD_WIDTH / 2 - (textW + iconGap) / 2);
  const cy = barY + barH / 2;

  // 矢量足球徽章（零 emoji，全端锐利一致）
  ctx.save();
  ctx.fillStyle = "#FF453A";
  ctx.beginPath();
  ctx.arc(startX + 15, cy, 16, 0, Math.PI * 2, false);
  ctx.fill();
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(startX + 15, cy, 9, 0, Math.PI * 2, false);
  ctx.stroke();
  ctx.fillStyle = "#FFFFFF";
  ctx.beginPath();
  ctx.arc(startX + 15, cy, 3.5, 0, Math.PI * 2, false);
  ctx.fill();
  ctx.restore();

  drawText(ctx, fitted.text, startX + iconGap, cy + 1, fitted.size, "#16070B", "left", 900);
}

function drawTeamBadge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  initial: string,
  loadedLogo?: LoadedShareAvatar,
) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2, false);
  ctx.clip();

  if (loadedLogo && loadedLogo.width > 0 && loadedLogo.height > 0) {
    const scale = Math.max((radius * 2) / loadedLogo.width, (radius * 2) / loadedLogo.height);
    const drawW = loadedLogo.width * scale;
    const drawH = loadedLogo.height * scale;
    ctx.drawImage(
      loadedLogo.image as unknown as CanvasImageSource,
      cx - drawW / 2,
      cy - drawH / 2,
      drawW,
      drawH,
    );
  } else {
    const grad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    grad.addColorStop(0, "#FF6B35");
    grad.addColorStop(1, "#6E1324");
    ctx.fillStyle = grad;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    drawText(ctx, initial, cx, cy + 2, radius * 0.92, "#FFFFFF", "center", 900);
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2, false);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.restore();
}

function drawTeamIdentityBand(
  ctx: CanvasRenderingContext2D,
  view: HomeShareCardViewModel,
  loadedImages: ReadonlyMap<string, LoadedShareAvatar>,
) {
  const x = 42;
  const y = 118;
  const w = 916;
  const h = 260;

  ctx.save();
  ctx.fillStyle = "rgba(12, 6, 10, 0.72)";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#FF8A3D";
  ctx.fillRect(x, y, 14, h);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();

  const logo = view.teamLogoUrl ? loadedImages.get(view.teamLogoUrl) : undefined;
  drawTeamBadge(ctx, 152, 248, 72, view.teamInitial, logo);

  drawText(ctx, "MY CLUB · 所在球队", 254, 172, 22, "#FFD166", "left", 800);

  const nameMaxWidth = view.creditBadgeText ? 500 : 660;
  const fittedName = fitText(ctx, view.teamName, nameMaxWidth, 64, 38, 900);
  drawText(ctx, fittedName.text, 254, 238, fittedName.size, "#FFFFFF", "left", 900);

  // 右上信誉角标
  if (view.creditBadgeText) {
    ctx.save();
    roundRectPath(ctx, 774, 150, 154, 42, 8);
    ctx.fillStyle = "rgba(255, 69, 58, 0.22)";
    ctx.fill();
    ctx.restore();
    drawText(ctx, view.creditBadgeText, 851, 171, 21, "#FF9E8A", "center", 800);
  }

  // 活跃数据双胶囊
  const pill1W = Math.min(240, Math.max(176, measureTextWidth(ctx, view.memberPillText, 21) + 42));
  ctx.save();
  roundRectPath(ctx, 254, 294, pill1W, 42, 21);
  ctx.fillStyle = "rgba(0, 235, 199, 0.16)";
  ctx.fill();
  ctx.strokeStyle = "#00EBC7";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  drawText(ctx, view.memberPillText, 254 + pill1W / 2, 315, 21, "#00EBC7", "center", 800);

  const pill2X = 254 + pill1W + 16;
  const pill2MaxW = Math.max(160, x + w - 28 - pill2X);
  const pill2W = Math.min(pill2MaxW, Math.max(196, measureTextWidth(ctx, view.schedulePillText, 21) + 42));
  ctx.save();
  roundRectPath(ctx, pill2X, 294, pill2W, 42, 21);
  ctx.fillStyle = "rgba(255, 255, 255, 0.10)";
  ctx.fill();
  ctx.restore();
  const fittedSchedule = fitText(ctx, view.schedulePillText, pill2W - 24, 21, 17, 700);
  drawText(ctx, fittedSchedule.text, pill2X + pill2W / 2, 315, fittedSchedule.size, "#F4EAEA", "center", 700);
}

function drawFeatureGlyph(
  ctx: CanvasRenderingContext2D,
  kind: "signup" | "lineup" | "match" | "bill",
  cx: number,
  cy: number,
) {
  ctx.save();
  ctx.strokeStyle = "#00EBC7";
  ctx.fillStyle = "#00EBC7";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (kind === "signup") {
    // 勾号圆徽
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy);
    ctx.lineTo(cx - 2, cy + 5);
    ctx.lineTo(cx + 8, cy - 6);
    ctx.stroke();
  } else if (kind === "lineup") {
    // 战术板 + 阵型点
    ctx.strokeRect(cx - 17, cy - 13, 34, 26);
    ctx.beginPath();
    ctx.moveTo(cx, cy - 13);
    ctx.lineTo(cx, cy + 13);
    ctx.stroke();
    for (const [dx, dy] of [[-9, -5], [-9, 5], [9, 0]]) {
      ctx.beginPath();
      ctx.arc(cx + dx, cy + dy, 3.2, 0, Math.PI * 2, false);
      ctx.fill();
    }
  } else if (kind === "match") {
    // 足球菱纹徽章
    ctx.strokeStyle = "#FF8A3D";
    ctx.fillStyle = "#FF8A3D";
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2, false);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2, false);
    ctx.fill();
  } else {
    // 账单卡片线条
    ctx.strokeStyle = "#FFD166";
    ctx.strokeRect(cx - 14, cy - 16, 28, 32);
    ctx.beginPath();
    ctx.moveTo(cx - 7, cy - 5);
    ctx.lineTo(cx + 7, cy - 5);
    ctx.moveTo(cx - 7, cy + 4);
    ctx.lineTo(cx + 4, cy + 4);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFeatureTilesRow(ctx: CanvasRenderingContext2D, y: number, tileHeight: number) {
  const tiles: Array<{ kind: "signup" | "lineup" | "match" | "bill"; title: string }> = [
    { kind: "signup", title: "一键报名统计" },
    { kind: "lineup", title: "可视化排阵型" },
    { kind: "match", title: "在线约队拼场" },
    { kind: "bill", title: "队费账单透明" },
  ];
  tiles.forEach((tile, idx) => {
    const tx = 86 + idx * 212;
    ctx.save();
    roundRectPath(ctx, tx, y, 196, tileHeight, 14);
    ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    drawFeatureGlyph(ctx, tile.kind, tx + 98, y + tileHeight * 0.36);
    drawText(ctx, tile.title, tx + 98, y + tileHeight * 0.74, 22, "#F5EBEB", "center", 800);
  });
}

function drawNextMatchBand(
  ctx: CanvasRenderingContext2D,
  view: HomeShareCardViewModel,
  loadedImages: ReadonlyMap<string, LoadedShareAvatar>,
) {
  const x = 42;
  const y = 404;
  const w = 916;
  const h = 254;

  ctx.save();
  ctx.fillStyle = "rgba(12, 6, 10, 0.78)";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#00EBC7";
  ctx.fillRect(x, y, 14, h);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();

  const fittedKicker = fitText(ctx, view.nextMatchKicker, 830, 24, 19, 800);
  drawText(ctx, fittedKicker.text, 84, y + 44, fittedKicker.size, "#00EBC7", "left", 800);

  const fittedHeadline = fitText(ctx, view.nextMatchHeadline, 836, 38, 26, 900);
  drawText(ctx, fittedHeadline.text, 84, y + 98, fittedHeadline.size, "#FFFFFF", "left", 900);

  drawText(ctx, "兄弟们都已报名：", 84, y + 154, 22, "rgba(255, 255, 255, 0.68)", "left", 700);
  drawText(ctx, view.nextMatchJoinedLabel, 84, y + 198, 26, "#FFD166", "left", 900);

  if (view.nextMatchJoinedCount > 0 && view.nextMatchAvatars.length > 0) {
    drawRegistrationAvatarStack(
      ctx,
      view.nextMatchAvatars,
      view.nextMatchJoinedCount,
      loadedImages,
      {
        startX: 268,
        cy: y + 190,
        radius: 30,
        overlap: 11,
        maxVisible: MAX_HOME_SHARE_AVATARS,
        ringColor: "#16070B",
      },
    );
  } else {
    // 暂无报名头像时画 5 个虚线空位圆，保持节奏平衡
    for (let i = 0; i < 5; i += 1) {
      const cx = 294 + i * 48;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, y + 190, 24, 0, Math.PI * 2, false);
      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.fill();
      if (typeof ctx.setLineDash === "function") ctx.setLineDash([5, 4]);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.36)";
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
    drawText(ctx, "快来抢占首名席位", 548, y + 190, 23, "rgba(255, 255, 255, 0.72)", "left", 700);
  }
}

function drawTeamIdleFeatureBand(ctx: CanvasRenderingContext2D) {
  const x = 42;
  const y = 404;
  const w = 916;
  const h = 254;

  ctx.save();
  ctx.fillStyle = "rgba(12, 6, 10, 0.78)";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#00EBC7";
  ctx.fillRect(x, y, 14, h);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();

  drawText(ctx, "CLUB TOOLS · 球队日常一站搞定", 84, y + 48, 23, "#00EBC7", "left", 800);
  drawFeatureTilesRow(ctx, y + 92, 126);
}

function drawBrandHeroBand(ctx: CanvasRenderingContext2D) {
  const x = 42;
  const y = 126;
  const w = 916;
  const h = 526;

  ctx.save();
  ctx.fillStyle = "rgba(12, 6, 10, 0.74)";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "#00EBC7";
  ctx.fillRect(x, y, 14, h);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
  ctx.restore();

  drawText(ctx, "组队 · 报名 · 排阵 · 约战", 500, 210, 28, "#00EBC7", "center", 800);
  drawText(ctx, "周末去哪踢？", 500, 302, 78, "#FFFFFF", "center", 900);
  drawText(ctx, "3秒建队拉球友，附近散人局随到随踢", 500, 386, 30, "rgba(255, 255, 255, 0.82)", "center", 700);
  drawFeatureTilesRow(ctx, 466, 118);
}

async function resolveHomeShareImages(
  canvas: Canvas2DNode,
  urls: readonly string[],
  loadImage: (src: string) => Promise<ShareCardImageInfo>,
  isCurrent: () => boolean,
): Promise<Map<string, LoadedShareAvatar>> {
  const result = new Map<string, LoadedShareAvatar>();
  if (urls.length === 0) return result;

  const entries = await Promise.all(
    urls.map(async (url) => {
      try {
        const info = await loadImage(url);
        if (!isCurrent() || !info?.path) return null;
        const image = await loadCanvas2DImage(canvas, info.path);
        const width = image.width || info.width;
        const height = image.height || info.height;
        if (width > 0 && height > 0) {
          return [url, { image, width, height }] as const;
        }
        return null;
      } catch {
        // 单个队徽或头像下载失败时优雅回退首字圆徽，不阻断分享卡合成。
        return null;
      }
    }),
  );
  for (const pair of entries) {
    if (pair) result.set(pair[0], pair[1]);
  }
  return result;
}

export { createMatchShareImageLoader as createHomeShareImageLoader };

/**
 * 合成首页 1000×800（5:4）方案 A 社交分享卡（球队召集令），使用标准 `<canvas type="2d">`。
 * 自动适配「有球队+下场赛程」「有球队无赛程」「无球队/游客」三种状态。
 */
export async function composeHomeShareCard(
  canvasId: string,
  pageInstance: unknown,
  input: HomeShareCardInput,
  isCurrent: () => boolean = () => true,
  loadImage: (src: string) => Promise<ShareCardImageInfo> = getDefaultImageInfo,
): Promise<string> {
  if (!isCurrent()) throw new Error("首页分享卡内容已更新");

  const view = buildHomeShareCardViewModel(input);
  const canvas = await queryCanvas2DNode(canvasId, pageInstance);
  if (!isCurrent()) throw new Error("首页分享卡内容已更新");

  const imageUrls = collectHomeShareImageUrls(view);
  const loadedImages = await resolveHomeShareImages(canvas, imageUrls, loadImage, isCurrent);
  if (!isCurrent()) throw new Error("首页分享卡内容已更新");

  canvas.width = HOME_SHARE_CARD_WIDTH;
  canvas.height = HOME_SHARE_CARD_HEIGHT;
  const ctx = canvas.getContext("2d");

  drawFieryBackdrop(ctx);
  drawTopRibbon(ctx, view.ribbonText);

  if (view.mode === "brand") {
    drawBrandHeroBand(ctx);
  } else {
    drawTeamIdentityBand(ctx, view, loadedImages);
    if (view.mode === "team-next-match") {
      drawNextMatchBand(ctx, view, loadedImages);
    } else {
      drawTeamIdleFeatureBand(ctx);
    }
  }

  drawWhiteActionFooter(ctx, view.footerText);
  return exportCanvas2DToTempFile(canvas, isCurrent);
}
