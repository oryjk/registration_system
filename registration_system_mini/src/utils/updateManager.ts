/** 微信小程序版本更新引导。
 *  微信在冷启动时异步下载新版本，但本次启动仍用旧版；注册本监听后，
 *  新版本下载完成时弹窗征得用户确认，再重启切换到新版本。 */
export function setupMiniProgramUpdatePrompt(): void {
  // #ifdef MP-WEIXIN
  try {
    const updateManager = uni.getUpdateManager();

    updateManager.onCheckForUpdate((result) => {
      console.log("mini program update check, hasUpdate:", result.hasUpdate);
    });

    updateManager.onUpdateReady(() => {
      uni.showModal({
        title: "更新提示",
        content: "新版本已经准备好，是否重启应用？",
        success: (result) => {
          if (result.confirm) {
            // applyUpdate 会立即重启并丢失页面状态，只能在用户确认后调用
            updateManager.applyUpdate();
          }
        },
      });
    });

    updateManager.onUpdateFailed(() => {
      uni.showModal({
        title: "更新提示",
        content: "新版本下载失败，请检查网络后重新打开小程序",
        showCancel: false,
      });
    });
  } catch (error) {
    // 基础库过旧等情况下 API 不可用，降级为微信默认的下一次冷启动生效
    console.warn("update manager unavailable", error);
  }
  // #endif
}
