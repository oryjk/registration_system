import { TEAM_INVITE_SHARE_IMAGE_URL } from "@/utils/share";

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 800;
// 队徽圆形徽章：贴在封面中下部偏左的空隙，不遮主文案与人物主体。
const LOGO_CENTER_X = 320;
const LOGO_CENTER_Y = 640;
const LOGO_RADIUS = 95;
const LOGO_BORDER_WIDTH = 12;

/** 小程序 canvas type="2d" 节点的最小接口（无官方 TS 类型，仅声明用到的方法）。 */
interface Canvas2DNode {
  width: number;
  height: number;
  getContext(type: "2d"): CanvasRenderingContext2D;
  createImage(): CanvasImageLike & {
    onload: (() => void) | null;
    onerror: ((error: unknown) => void) | null;
    src: string;
  };
  toTempFilePath(options: {
    fileType?: string;
    quality?: number;
    success: (result: { tempFilePath: string }) => void;
    fail: (error: unknown) => void;
  }): void;
}

interface CanvasImageLike {
  width: number;
  height: number;
}

type SelectorQueryLike = {
  select: (selector: string) => { fields: (options: { node: boolean; size: boolean }) => void };
  exec: (callback: (results: Array<{ node?: Canvas2DNode } | null>) => void) => void;
};

function queryCanvasNode(canvasId: string, pageInstance: unknown): Promise<Canvas2DNode> {
  return new Promise((resolve, reject) => {
    // uni 的 SelectorQuery 类型签名与运行时行为不一致，收窄到本项目用到的最小接口。
    const query = uni.createSelectorQuery().in(pageInstance as never) as unknown as SelectorQueryLike;
    query.select(`#${canvasId}`).fields({ node: true, size: true });
    query.exec((results) => {
      const node = results?.[0]?.node;
      if (!node) {
        reject(new Error(`share canvas #${canvasId} not found`));
        return;
      }
      resolve(node);
    });
  });
}

function loadImage(canvas: Canvas2DNode, src: string): Promise<CanvasImageLike> {
  return new Promise((resolve, reject) => {
    const image = canvas.createImage();
    image.onload = () => resolve(image);
    image.onerror = (error) => reject(error);
    image.src = src;
  });
}

function getImagePath(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.getImageInfo({ src: url, success: (result) => resolve(result.path), fail: reject });
  });
}

/**
 * 把球队队徽合成到邀请分享封面，返回合成图的本地临时路径（仅微信小程序调用；
 * H5 无转发卡片，分享继续用静态封面 URL）。onShareAppMessage 的 imageUrl 不接受
 * dataURL，必须走 canvas toTempFilePath 的临时文件。任一步失败 reject，
 * 由调用方静默回落 TEAM_INVITE_SHARE_IMAGE_URL。
 */
export async function composeTeamInviteShareImage(
  canvasId: string,
  pageInstance: unknown,
  logoUrl: string,
): Promise<string> {
  const canvas = await queryCanvasNode(canvasId, pageInstance);
  const [coverPath, logoPath] = await Promise.all([
    getImagePath(TEAM_INVITE_SHARE_IMAGE_URL),
    getImagePath(logoUrl),
  ]);
  const [coverImage, logoImage] = await Promise.all([
    loadImage(canvas, coverPath),
    loadImage(canvas, logoPath),
  ]);

  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.drawImage(coverImage as Parameters<CanvasRenderingContext2D["drawImage"]>[0], 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // 圆形裁剪内按短边居中绘制，非正方形 logo 不拉伸变形。
  ctx.save();
  ctx.beginPath();
  ctx.arc(LOGO_CENTER_X, LOGO_CENTER_Y, LOGO_RADIUS, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  const cropSize = Math.min(logoImage.width, logoImage.height);
  const cropX = (logoImage.width - cropSize) / 2;
  const cropY = (logoImage.height - cropSize) / 2;
  ctx.drawImage(
    logoImage as Parameters<CanvasRenderingContext2D["drawImage"]>[0],
    cropX,
    cropY,
    cropSize,
    cropSize,
    LOGO_CENTER_X - LOGO_RADIUS,
    LOGO_CENTER_Y - LOGO_RADIUS,
    LOGO_RADIUS * 2,
    LOGO_RADIUS * 2,
  );
  ctx.restore();

  ctx.beginPath();
  ctx.arc(LOGO_CENTER_X, LOGO_CENTER_Y, LOGO_RADIUS + LOGO_BORDER_WIDTH / 2, 0, Math.PI * 2);
  ctx.lineWidth = LOGO_BORDER_WIDTH;
  ctx.strokeStyle = "#FFFFFF";
  ctx.stroke();

  return new Promise<string>((resolve, reject) => {
    canvas.toTempFilePath({
      fileType: "jpg",
      quality: 0.92,
      success: (result) => resolve(result.tempFilePath),
      fail: reject,
    });
  });
}
