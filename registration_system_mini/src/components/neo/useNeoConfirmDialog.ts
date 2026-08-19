import { reactive, ref } from "vue";
import type { NeoConfirmDialogTone } from "./NeoConfirmDialog.vue";

export interface NeoConfirmDialogOptions {
  title: string;
  content: string;
  /** message 下方展示的图片（如微信二维码），随提示一起渲染。 */
  imageSrc?: string;
  confirmText?: string;
  cancelText?: string;
  /** 需要在内容中醒目展示的文本（如比赛名称），命中后用高亮样式渲染。 */
  highlight?: string;
  /** 内容中可点击的文本片段，命中后用链接样式渲染；点击时关闭弹窗并执行 onLink。 */
  linkText?: string;
  /** 链接片段被点击后的动作（如跳转页面）。 */
  onLink?: () => void;
  /** 危险操作（取消报名等）主按钮使用 danger 色调。 */
  danger?: boolean;
}

export interface NeoConfirmDialogState {
  title: string;
  message: string;
  imageSrc: string;
  highlight: string;
  linkText: string;
  primaryText: string;
  secondaryText: string;
  primaryTone: NeoConfirmDialogTone;
}

/**
 * neo 风格确认弹窗的状态驱动 composable。
 *
 * 页面在模板中渲染 <NeoConfirmDialog> 并绑定返回的 visible/state/handlers，
 * 业务逻辑通过 confirm() 以 Promise 方式等待用户选择，替代 uni.showModal。
 */
export function useNeoConfirmDialog() {
  const confirmDialogVisible = ref(false);
  const confirmDialogState = reactive<NeoConfirmDialogState>({
    title: "",
    message: "",
    imageSrc: "",
    highlight: "",
    linkText: "",
    primaryText: "确认",
    secondaryText: "再想想",
    primaryTone: "accent",
  });
  let resolver: ((confirmed: boolean) => void) | null = null;
  let linkHandler: (() => void) | null = null;

  /** 打开弹窗；主按钮 resolve(true)，次要按钮/遮罩/关闭 resolve(false)。 */
  function confirm(options: NeoConfirmDialogOptions): Promise<boolean> {
    if (resolver) {
      resolver(false);
      resolver = null;
    }
    confirmDialogState.title = options.title;
    confirmDialogState.message = options.content;
    confirmDialogState.imageSrc = options.imageSrc ?? "";
    confirmDialogState.highlight = options.highlight ?? "";
    confirmDialogState.linkText = options.linkText ?? "";
    confirmDialogState.primaryText = options.confirmText ?? "确认";
    confirmDialogState.secondaryText = options.cancelText ?? "再想想";
    confirmDialogState.primaryTone = options.danger ? "danger" : "accent";
    linkHandler = options.onLink ?? null;
    confirmDialogVisible.value = true;
    return new Promise<boolean>((resolve) => {
      resolver = resolve;
    });
  }

  function settle(confirmed: boolean) {
    if (!confirmDialogVisible.value) return;
    confirmDialogVisible.value = false;
    const resolve = resolver;
    resolver = null;
    resolve?.(confirmed);
  }

  function handleConfirmPrimary() {
    settle(true);
  }

  function handleConfirmSecondary() {
    settle(false);
  }

  function handleConfirmClose() {
    settle(false);
  }

  /** 链接片段点击：关闭弹窗（视同未确认）后执行跳转等动作。 */
  function handleConfirmLink() {
    if (!confirmDialogVisible.value) return;
    const handler = linkHandler;
    settle(false);
    handler?.();
  }

  return {
    confirmDialogVisible,
    confirmDialogState,
    confirm,
    handleConfirmPrimary,
    handleConfirmSecondary,
    handleConfirmClose,
    handleConfirmLink,
  };
}
