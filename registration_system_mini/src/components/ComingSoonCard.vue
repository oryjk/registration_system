<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
  tags?: string[];
}>();
</script>

<template>
  <view class="panel">
    <view class="panel-title">{{ title }}</view>
    <view class="panel-text">{{ description }}</view>
    <view v-if="tags?.length" class="chip-row">
      <text v-for="tag in tags" :key="tag" class="chip">{{ tag }}</text>
    </view>
  </view>
</template>
