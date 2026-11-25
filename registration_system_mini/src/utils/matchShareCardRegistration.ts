import type { MatchShareCanvasImage } from "./matchShareCardCompose";

export interface MatchShareAvatarItem {
  name: string;
  avatarUrl?: string | null;
  tone?: string;
}

export interface MatchShareRegistrationGroup {
  label?: string;
  joinedCount: number;
  requiredCount?: number | null;
  avatars: MatchShareAvatarItem[];
}

export type MatchShareRegistrationInput =
  | {
      mode: "single";
      group: MatchShareRegistrationGroup;
    }
  | {
      mode: "dual";
      home: MatchShareRegistrationGroup;
      away: MatchShareRegistrationGroup;
    };

export interface LoadedShareAvatar {
  image: MatchShareCanvasImage;
  width: number;
  height: number;
}

export interface RegistrationStatusBadge {
  text: string;
  accentColor: string;
  pillBg: string;
  ratio: number;
}

const FALLBACK_AVATAR_COLORS = [
  "#2563EB",
  "#059669",
  "#D97706",
  "#7C3AED",
  "#DC2626",
  "#0891B2",
  "#4F46E5",
  "#EA580C",
  "#0D9488",
  "#9333EA",
];

export const MAX_SINGLE_REGISTRATION_AVATARS = 10;
export const MAX_DUAL_REGISTRATION_AVATARS = 7;
export const MAX_HEADLINE_REGISTRATION_AVATARS = 11;

/** 归一化头像首字，兼容中英文及空昵称。 */
export function resolveAvatarInitial(name?: string | null): string {
  const clean = name?.trim() || "";
  if (!clean) return "球";
  return Array.from(clean)[0] || "球";
}

function resolveAvatarFallbackBg(item: MatchShareAvatarItem, index: number): string {
  const tone = item.tone?.trim() || "";
  if (/^#[0-9a-f]{6}$/i.test(tone)) return tone;
  return FALLBACK_AVATAR_COLORS[index % FALLBACK_AVATAR_COLORS.length]!;
}

/** 根据已报人数与成行门槛生成高对比状态文案与进度比例。 */
export function formatRegistrationStatusBadge(
  joinedCount: number,
  requiredCount?: number | null,
): RegistrationStatusBadge {
  const joined = Math.max(0, Math.floor(Number.isFinite(joinedCount) ? joinedCount : 0));
  const min = requiredCount && Number.isFinite(requiredCount) && requiredCount > 0
    ? Math.floor(requiredCount)
    : 0;

  if (joined <= 0) {
    return {
      text: min > 0 ? `0/${min} · 抢先报名` : "火热报名中",
      accentColor: "#FFD166",
      pillBg: "rgba(255, 209, 102, 0.16)",
      ratio: 0,
    };
  }
  if (min > 0 && joined >= min) {
    return {
      text: `已报 ${joined}/${min} · 已成行`,
      accentColor: "#00EBC7",
      pillBg: "rgba(0, 235, 199, 0.16)",
      ratio: 1,
    };
  }
  if (min > 0) {
    return {
      text: `已报 ${joined}/${min} · 差 ${min - joined} 人`,
      accentColor: "#FFD166",
      pillBg: "rgba(255, 209, 102, 0.18)",
      ratio: Math.min(1, joined / min),
    };
  }
  return {
    text: `已报 ${joined} 人`,
    accentColor: "#00EBC7",
    pillBg: "rgba(0, 235, 199, 0.16)",
    ratio: 1,
  };
}

/** 仅提取当前卡片可见槽位所需的去重头像 URL，避免超大局并发拉取多余图片。 */
export function collectRegistrationAvatarUrls(
  registration?: MatchShareRegistrationInput | null,
): string[] {
  if (!registration) return [];
  const urls: string[] = [];
  const pushFrom = (avatars: readonly MatchShareAvatarItem[], limit: number) => {
    for (const item of avatars.slice(0, limit)) {
      const url = item.avatarUrl?.trim() || "";
      if (url) urls.push(url);
    }
  };
  if (registration.mode === "single") {
    pushFrom(registration.group.avatars, MAX_HEADLINE_REGISTRATION_AVATARS);
  } else {
    pushFrom(registration.home.avatars, MAX_DUAL_REGISTRATION_AVATARS);
    pushFrom(registration.away.avatars, MAX_DUAL_REGISTRATION_AVATARS);
  }
  return Array.from(new Set(urls));
}

function drawRoundedPill(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawBoldLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  color: string,
  align: CanvasTextAlign = "left",
  strokeBoost = true,
) {
  const roundedSize = Math.round(size);
  ctx.save();
  ctx.font = `normal bold ${roundedSize}px sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  if (strokeBoost && typeof ctx.strokeText === "function") {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.8, roundedSize * 0.026);
    ctx.lineJoin = "round";
    ctx.strokeText(text, x, y);
  }
  ctx.fillText(text, x, y);
  ctx.restore();
}

function measureBoldWidth(ctx: CanvasRenderingContext2D, text: string, size: number): number {
  const roundedSize = Math.round(size);
  ctx.save();
  ctx.font = `normal bold ${roundedSize}px sans-serif`;
  const width = ctx.measureText(text)?.width;
  ctx.restore();
  if (typeof width === "number" && Number.isFinite(width) && width > 0) {
    return width * 1.05;
  }
  return Array.from(text).length * roundedSize;
}

/** 绘制重叠圆形头像排；超额部分自动追加 `#FF453A`「+N」圆徽章。 */
export function drawRegistrationAvatarStack(
  ctx: CanvasRenderingContext2D,
  avatars: readonly MatchShareAvatarItem[],
  totalCount: number,
  loadedAvatars: ReadonlyMap<string, LoadedShareAvatar>,
  options: {
    startX: number;
    cy: number;
    radius: number;
    overlap: number;
    maxVisible: number;
    ringColor?: string;
  },
): number {
  const { startX, cy, radius, overlap, maxVisible, ringColor = "#16070B" } = options;
  const shown = avatars.slice(0, maxVisible);
  const extra = Math.max(0, totalCount - shown.length);
  const step = radius * 2 - overlap;

  shown.forEach((item, index) => {
    const cx = startX + radius + index * step;
    const url = item.avatarUrl?.trim() || "";
    const loaded = url ? loadedAvatars.get(url) : undefined;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2, false);
    ctx.clip();
    ctx.fillStyle = resolveAvatarFallbackBg(item, index);
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    if (loaded) {
      const side = Math.min(loaded.width, loaded.height);
      ctx.drawImage(
        loaded.image as Parameters<CanvasRenderingContext2D["drawImage"]>[0],
        (loaded.width - side) / 2,
        (loaded.height - side) / 2,
        side,
        side,
        cx - radius,
        cy - radius,
        radius * 2,
        radius * 2,
      );
    } else {
      drawBoldLabel(ctx, resolveAvatarInitial(item.name), cx, cy + 1, radius * 0.92, "#FFFFFF", "center", false);
    }
    ctx.restore();

    // 圆形外描边隔离重叠头像
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2, false);
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();
  });

  if (extra > 0) {
    const cx = startX + radius + shown.length * step;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2, false);
    ctx.fillStyle = "#FF453A";
    ctx.fill();
    ctx.strokeStyle = ringColor;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    ctx.restore();
    drawBoldLabel(
      ctx,
      extra > 99 ? "99+" : `+${extra}`,
      cx,
      cy + 1,
      radius * (extra > 9 ? 0.74 : 0.84),
      "#FFFFFF",
      "center",
      true,
    );
    return shown.length + 1;
  }

  return shown.length;
}

function drawEmptyPlaceholderCircles(
  ctx: CanvasRenderingContext2D,
  startX: number,
  cy: number,
  count: number,
  radius: number,
  step: number,
) {
  for (let i = 0; i < count; i += 1) {
    const cx = startX + radius + i * step;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2, false);
    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    ctx.fill();
    if (typeof ctx.setLineDash === "function") {
      ctx.setLineDash([5, 4]);
    }
    ctx.strokeStyle = "rgba(255, 255, 255, 0.36)";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }
}

/**
 * 方案 A：独立大头像报名横条（y=556..668，w=916，h=112）。
 * - 单队报名（线下已约等）：左大号 58px 重叠头像排（最多 10 个 + `+N`）+ 右醒目状态胶囊 + 底 6px 进度条；
 * - 双队约队（线上约队赛）：左右平分展示主队 / 客队各自头像与报名进度。
 */
export function drawVersusRegistrationStrip(
  ctx: CanvasRenderingContext2D,
  registration: MatchShareRegistrationInput,
  loadedAvatars: ReadonlyMap<string, LoadedShareAvatar>,
) {
  const barX = 42;
  const barY = 556;
  const barW = 916;
  const barH = 112;

  ctx.save();
  ctx.fillStyle = "rgba(12, 6, 10, 0.74)";
  ctx.fillRect(barX, barY, barW, barH);
  ctx.fillStyle = "#00EBC7";
  ctx.fillRect(barX, barY, 14, barH);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.16)";
  ctx.lineWidth = 2;
  ctx.strokeRect(barX, barY, barW, barH);
  ctx.restore();

  if (registration.mode === "dual") {
    const drawHalf = (
      group: MatchShareRegistrationGroup,
      fallbackLabel: string,
      leftX: number,
      width: number,
    ) => {
      const status = formatRegistrationStatusBadge(group.joinedCount, group.requiredCount);
      const label = group.label?.trim() || fallbackLabel;
      const countText = group.requiredCount && group.requiredCount > 0
        ? `${label} ${group.joinedCount}/${group.requiredCount}`
        : `${label} ${group.joinedCount}人`;
      drawBoldLabel(ctx, countText, leftX, barY + 26, 22, status.accentColor, "left", true);

      if (group.joinedCount > 0 && group.avatars.length > 0) {
        drawRegistrationAvatarStack(ctx, group.avatars, group.joinedCount, loadedAvatars, {
          startX: leftX,
          cy: barY + 68,
          radius: 23,
          overlap: 11,
          maxVisible: MAX_DUAL_REGISTRATION_AVATARS,
          ringColor: "#16070B",
        });
      } else {
        drawEmptyPlaceholderCircles(ctx, leftX, barY + 68, 3, 20, 34);
        drawBoldLabel(ctx, "暂无人报名", leftX + 126, barY + 68, 20, "rgba(255, 255, 255, 0.62)", "left", false);
      }

      // 底部纤细进度条
      const trackY = barY + barH - 12;
      ctx.save();
      ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
      ctx.fillRect(leftX, trackY, width, 5);
      if (status.ratio > 0) {
        ctx.fillStyle = status.accentColor;
        ctx.fillRect(leftX, trackY, Math.max(16, width * status.ratio), 5);
      }
      ctx.restore();
    };

    drawHalf(registration.home, "主队", 76, 404);
    ctx.save();
    ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
    ctx.fillRect(500, barY + 18, 2, barH - 36);
    ctx.restore();
    drawHalf(registration.away, "客队", 524, 410);
    return;
  }

  // 单队报名模式：超大头像排 + 右侧状态胶囊 + 底部通栏进度条
  const group = registration.group;
  const status = formatRegistrationStatusBadge(group.joinedCount, group.requiredCount);

  // 先测量右侧胶囊宽度，确保左侧头像排绝不与状态胶囊碰撞
  const pillW = Math.min(340, Math.max(216, measureBoldWidth(ctx, status.text, 24) + 42));
  const pillH = 46;
  const pillX = barX + barW - 24 - pillW;
  const pillY = barY + 22;

  const avatarStartX = 78;
  const avatarCy = barY + 46;
  const avatarBudgetW = Math.max(120, pillX - avatarStartX - 20);
  const avatarRadius = 28;
  const avatarOverlap = 12;
  const avatarStep = avatarRadius * 2 - avatarOverlap;
  const fitSlots = Math.max(
    1,
    Math.min(MAX_SINGLE_REGISTRATION_AVATARS + 1, Math.floor((avatarBudgetW - avatarRadius * 2) / avatarStep) + 1),
  );
  const maxVisible = group.joinedCount > Math.min(MAX_SINGLE_REGISTRATION_AVATARS, fitSlots)
    ? Math.max(1, Math.min(MAX_SINGLE_REGISTRATION_AVATARS, fitSlots - 1))
    : Math.min(MAX_SINGLE_REGISTRATION_AVATARS, fitSlots);

  if (group.joinedCount > 0 && group.avatars.length > 0) {
    drawRegistrationAvatarStack(ctx, group.avatars, group.joinedCount, loadedAvatars, {
      startX: avatarStartX,
      cy: avatarCy,
      radius: avatarRadius,
      overlap: avatarOverlap,
      maxVisible,
      ringColor: "#16070B",
    });
  } else {
    drawEmptyPlaceholderCircles(ctx, avatarStartX, avatarCy, 4, 23, 40);
    drawBoldLabel(ctx, "虚位以待 · 快来抢占首名", avatarStartX + 184, avatarCy, 23, "rgba(255, 255, 255, 0.72)", "left", false);
  }

  // 右侧状态胶囊
  ctx.save();
  drawRoundedPill(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fillStyle = status.pillBg;
  ctx.fill();
  ctx.strokeStyle = status.accentColor;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
  drawBoldLabel(ctx, status.text, pillX + pillW / 2, pillY + pillH / 2 + 0.5, 23, status.accentColor, "center", true);

  // 底部 6px 成行进度条
  const trackX = 78;
  const trackY = barY + 94;
  const trackW = barX + barW - 24 - trackX;
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
  ctx.fillRect(trackX, trackY, trackW, 6);
  if (status.ratio > 0) {
    ctx.fillStyle = status.accentColor;
    ctx.fillRect(trackX, trackY, Math.max(20, trackW * status.ratio), 6);
  }
  ctx.restore();
}

/** 散人约球 / 场馆组局大字卡内的报名进度与居中大头像堆叠区。 */
export function drawHeadlineRegistrationFooter(
  ctx: CanvasRenderingContext2D,
  registration: MatchShareRegistrationInput,
  loadedAvatars: ReadonlyMap<string, LoadedShareAvatar>,
  options: { centerX: number; avatarCy: number; progressY: number; trackWidth: number },
) {
  const group = registration.mode === "single" ? registration.group : registration.home;
  const status = formatRegistrationStatusBadge(group.joinedCount, group.requiredCount);
  const { centerX, avatarCy, progressY, trackWidth } = options;

  if (group.joinedCount > 0 && group.avatars.length > 0) {
    const r = 29;
    const overlap = 12;
    const step = r * 2 - overlap;
    const shownCount = Math.min(group.avatars.length, MAX_HEADLINE_REGISTRATION_AVATARS);
    const hasMore = group.joinedCount > shownCount;
    const totalCircles = shownCount + (hasMore ? 1 : 0);
    const stackW = r * 2 + Math.max(0, totalCircles - 1) * step;
    drawRegistrationAvatarStack(ctx, group.avatars, group.joinedCount, loadedAvatars, {
      startX: centerX - stackW / 2,
      cy: avatarCy,
      radius: r,
      overlap,
      maxVisible: MAX_HEADLINE_REGISTRATION_AVATARS,
      ringColor: "#16070B",
    });
  } else {
    const count = 5;
    const r = 24;
    const step = 42;
    const stackW = r * 2 + (count - 1) * step;
    drawEmptyPlaceholderCircles(ctx, centerX - stackW / 2, avatarCy, count, r, step);
  }

  // 底部成行进度条
  const trackX = centerX - trackWidth / 2;
  ctx.save();
  ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
  ctx.fillRect(trackX, progressY, trackWidth, 8);
  if (status.ratio > 0) {
    ctx.fillStyle = status.accentColor;
    ctx.fillRect(trackX, progressY, Math.max(24, trackWidth * status.ratio), 8);
  }
  ctx.restore();
}
