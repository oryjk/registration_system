<script setup lang="ts">
withDefaults(defineProps<{
  visible?: boolean;
  flat?: boolean;
}>(), {
  visible: true,
  flat: false,
});
</script>

<template>
  <view v-if="visible" class="ui-sticky-action-bar" :class="{ 'ui-sticky-action-bar--flat': flat }">
    <view v-if="$slots.leading" class="ui-sticky-action-bar__leading">
      <slot name="leading" />
    </view>
    <view class="ui-sticky-action-bar__actions">
      <slot />
    </view>
  </view>
</template>

<style scoped>
.ui-sticky-action-bar {
  position: fixed;
  left: 50%;
  bottom: calc(env(safe-area-inset-bottom) + var(--ui-action-bar-bottom));
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 16rpx;
  width: calc(100% - 48rpx);
  max-width: 702rpx;
  padding: var(--ui-action-bar-padding);
  border: var(--ui-border-strong);
  border-radius: var(--ui-action-bar-radius);
  background: var(--ui-action-bar-bg);
  box-shadow: var(--ui-action-bar-shadow);
  transform: translateX(-50%);
  box-sizing: border-box;
}

.ui-sticky-action-bar--flat {
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.ui-sticky-action-bar__leading {
  min-width: 0;
  flex: 1;
}

.ui-sticky-action-bar__actions {
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
