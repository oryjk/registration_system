/** 微信首页专用压缩素材；MinIO 对象按内容哈希命名，图片不进小程序包。 */
export const HOME_VISUAL_ASSETS = {
  hero: "https://oryjk.cn:82/registration/static/home/visuals/v1/65166cb99b1a5d860e8fff7f.webp",
  createTeam: "https://oryjk.cn:82/registration/static/home/visuals/v1/26de9fb699849290c0cd2d0e.webp",
  joinTeam: "https://oryjk.cn:82/registration/static/home/visuals/v1/bfecb31f2565177d39156546.webp",
  findGame: "https://oryjk.cn:82/registration/static/home/visuals/v1/be2a00dd2bb3702ef0173336.webp",
  venueMap: "https://oryjk.cn:82/registration/static/home/visuals/v1/bf98e5a385fe831c55f8238a.webp",
} as const;

/** 十张默认比赛缩略图；保持顺序稳定，比赛 ID 决定分配结果。 */
export const HOME_MATCH_THUMBNAIL_POOL: readonly string[] = [
  "https://oryjk.cn:82/registration/match-covers/default-pool/v1/dc6e57d71e217a48fcf0e228.webp", // pitch-dusk
  "https://oryjk.cn:82/registration/match-covers/default-pool/v1/4d56ae087de77ab3bb3dccc5.webp", // ball-turf
  "https://oryjk.cn:82/registration/match-covers/default-pool/v1/c5e5625bf912d1a3c3f28e1b.webp", // goal-night
  "https://oryjk.cn:82/registration/match-covers/default-pool/v1/5e6f6994a7efb3f8dceed254.webp", // pitch-aerial
  "https://oryjk.cn:82/registration/match-covers/default-pool/v1/781a9e2bfb6c106c11747547.webp", // boots-ball
  "https://oryjk.cn:82/registration/match-covers/default-pool/v1/822a78bb840eb324c71ee82d.webp", // corner-flag
  "https://oryjk.cn:82/registration/match-covers/default-pool/v1/87534dfdc933064ac21e3e8a.webp", // kickoff
  "https://oryjk.cn:82/registration/match-covers/default-pool/v1/93c682c72bf9f18e8473dd99.webp", // net-detail
  "https://oryjk.cn:82/registration/match-covers/default-pool/v1/e064bf4c9374e4e7719da910.webp", // training-cones
  "https://oryjk.cn:82/registration/match-covers/default-pool/v1/6dac0eaac83f6565dc18ca08.webp", // pitch-morning
];
