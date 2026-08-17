<script setup lang="ts">
withDefaults(defineProps<{
  visible?: boolean;
}>(), {
  visible: true,
});
</script>

<template>
  <view v-if="visible" class="neo-sticky-action-bar">
    <view v-if="$slots.leading" class="neo-sticky-action-bar__leading">
      <slot name="leading" />
    </view>
    <view class="neo-sticky-action-bar__actions">
      <slot />
    </view>
  </view>
</template>

<style scoped>
.neo-sticky-action-bar {
  position: fixed;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom) + var(--neo-action-bar-bottom));
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 16rpx;
  width: calc(100% - 48rpx);
  max-width: 702rpx;
  padding: var(--neo-action-bar-padding);
  border: var(--neo-border-strong);
  border-radius: var(--neo-action-bar-radius);
  background: var(--neo-action-bar-bg);
  box-shadow: var(--neo-action-bar-shadow);
  transform: translateX(-50%);
  box-sizing: border-box;
}

.neo-sticky-action-bar__leading {
  min-width: 0;
  flex: 1;
}

.neo-sticky-action-bar__actions {
  display: flex;
  /* mp-weixin 下自定义组件有宿主节点，flex 行布局里宿主宽度收缩为内容宽，
     子组件内部 width:100% 无法撑满（H5 无此问题）；改用列方向 + stretch
     让宿主节点横向拉满，保证 block 按钮占满整个操作区。 */
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 12rpx;
  min-width: 0;
  flex: 1;
}
</style>
