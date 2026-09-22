import type { ConfirmDialogOptions } from "@/components/ui/useConfirmDialog";
import { DEVELOPER_WECHAT_QRCODE_URL, OFFICIAL_ACCOUNT_QRCODE_URL } from "@/utils/developerContact";

/**
 * 球队约队/创建比赛需要可管理的球队或场馆身份；散人点击禁用入口时的统一引导文案。
 * 经 useConfirmDialog().confirm() 渲染为 统一风格弹窗（单按钮提示）。
 */
export const MATCH_CREATION_IDENTITY_HINT: ConfirmDialogOptions = {
  title: "需要球队或场馆身份",
  content: "创建比赛需要先创建球队，或扫下方二维码加微信/关注公众号联系开发者成为场馆。散人也可以直接发布散人约球。",
  imageSrc: DEVELOPER_WECHAT_QRCODE_URL,
  imageCaption: "加开发者微信",
  secondImageSrc: OFFICIAL_ACCOUNT_QRCODE_URL,
  secondImageCaption: "关注公众号",
  confirmText: "知道了",
  cancelText: "",
  linkText: "创建球队",
  onLink: () => uni.navigateTo({ url: "/pages/teams/create/index" }),
};
