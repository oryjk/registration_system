import type { ConfirmDialogOptions } from "@/components/ui/useConfirmDialog";

/**
 * 球队约队/创建比赛需要队长或领队身份；没有该身份的用户点击禁用入口时的统一引导文案。
 * 经 useConfirmDialog().confirm() 渲染为 统一风格弹窗（单按钮提示）。
 */
export const MATCH_CREATION_IDENTITY_HINT: ConfirmDialogOptions = {
  title: "需要队长或领队身份",
  content: "球队比赛由队长或领队发起。你可以创建自己的球队，也可以直接发布散人约球。",
  confirmText: "知道了",
  cancelText: "",
  linkText: "创建球队",
  onLink: () => uni.navigateTo({ url: "/pages/teams/create/index" }),
};
