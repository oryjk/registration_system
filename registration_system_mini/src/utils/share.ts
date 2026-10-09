// 新版默认分享封面存于对象存储，不占主包；后台配置为空时回退到这些版本化地址。
export const DEFAULT_SHARE_IMAGE_URL = "https://oryjk.cn:82/registration/static/share/v3/hall/d5d92312777f753d.jpg";
export const TEAM_INVITE_SHARE_IMAGE_URL = "https://oryjk.cn:82/registration/static/share/v3/team/ce41cead949119b7.jpg";
export const MATCH_DETAIL_SHARE_IMAGE_URL = "https://oryjk.cn:82/registration/static/share/v3/match/46e9b1150ec86fbc.jpg";
export const HOME_SHARE_IMAGE_URL = "https://oryjk.cn:82/registration/static/share/v3/home/48a81eeaec54e66f.jpg";

export type ShareCoverScene = "home" | "hall" | "team" | "match";
export const DEFAULT_SHARE_COVERS: Record<ShareCoverScene, string> = {
  home: HOME_SHARE_IMAGE_URL,
  hall: DEFAULT_SHARE_IMAGE_URL,
  team: TEAM_INVITE_SHARE_IMAGE_URL,
  match: MATCH_DETAIL_SHARE_IMAGE_URL,
};

/** 分享回调必须同步返回封面；未配置或旧服务器缺字段时始终有安全的静态封面。 */
export function resolveShareCover(scene: ShareCoverScene, home: Partial<Record<`share_${ShareCoverScene}_image_url`, string>>): string {
  const url = home[`share_${scene}_image_url`]?.trim();
  return url && /^https:\/\//i.test(url) ? url : DEFAULT_SHARE_COVERS[scene];
}
