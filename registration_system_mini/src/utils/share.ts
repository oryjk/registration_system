export const DEFAULT_SHARE_IMAGE_URL = "/static/share/share-cover.png";

// 球队拉新分享封面：海报已裁为 5:4 并去掉底部二维码与示例队名（静态图无法按球队动态生成）。
// 图片放在 MinIO（约 155KB），不占主包体积；微信展示分享卡片时自行下载。
export const TEAM_INVITE_SHARE_IMAGE_URL = "https://oryjk.cn:82/registration/static/share/team-invite-cover.jpg";

// 比赛报名详情分享封面：同样放 MinIO（约 256KB），不占主包体积。
export const MATCH_DETAIL_SHARE_IMAGE_URL = "https://oryjk.cn:82/registration/static/share/match-detail-cover.jpg";
