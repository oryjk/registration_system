import type { NeoConfirmDialogOptions } from "@/components/neo/useNeoConfirmDialog";

/** 场馆合作联系二维码（产品负责人微信）：存于 out109 MinIO bucket registration 的 venue/ 前缀。 */
const VENUE_CONTACT_QRCODE_URL = "https://oryjk.cn:82/registration/venue/contact-qrcode.jpg";

/**
 * 球队约队/创建比赛需要可管理的球队或场馆身份；散人点击禁用入口时的统一引导文案。
 * 经 useNeoConfirmDialog().confirm() 渲染为 neo 风格弹窗（单按钮提示）。
 */
export const MATCH_CREATION_IDENTITY_HINT: NeoConfirmDialogOptions = {
  title: "需要球队或场馆身份",
  content: "创建比赛需要先创建球队，或扫下方二维码加微信联系开发者成为场馆。散人也可以直接发布散人约球。",
  imageSrc: VENUE_CONTACT_QRCODE_URL,
  confirmText: "知道了",
  cancelText: "",
  linkText: "创建球队",
  onLink: () => uni.navigateTo({ url: "/pages/teams/create/index" }),
};
