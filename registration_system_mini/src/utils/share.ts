// 新版默认分享封面存于对象存储，不占主包；后台配置为空时回退到这些版本化地址。
export const DEFAULT_SHARE_IMAGE_URL = "https://oryjk.cn:82/registration/static/share/v2/hall/ce7d5989e065c151.png";
export const TEAM_INVITE_SHARE_IMAGE_URL = "https://oryjk.cn:82/registration/static/share/v2/team/ff97d8a79c4c24fb.png";
export const MATCH_DETAIL_SHARE_IMAGE_URL = "https://oryjk.cn:82/registration/static/share/v2/match/18677ed042e00b13.png";
export const HOME_SHARE_IMAGE_URL = "https://oryjk.cn:82/registration/static/share/v2/home/efca682b6c5c37be.png";

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
