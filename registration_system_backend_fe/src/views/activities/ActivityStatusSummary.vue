<template>
  <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
    <div class="stat rounded-xl border border-base-300 bg-base-100 px-5 py-4 shadow-sm">
      <div class="stat-title text-xs">活动总数</div>
      <div class="stat-value text-2xl">{{ counts.total }}</div>
    </div>
    <div class="stat rounded-xl border border-base-300 bg-base-100 px-5 py-4 shadow-sm">
      <div class="stat-title text-xs">报名中</div>
      <div class="stat-value text-2xl text-info">{{ counts.registering }}</div>
    </div>
    <div class="stat rounded-xl border border-base-300 bg-base-100 px-5 py-4 shadow-sm">
      <div class="stat-title text-xs">进行中</div>
      <div class="stat-value text-2xl text-success">{{ counts.ongoing }}</div>
    </div>
    <div class="stat rounded-xl border border-base-300 bg-base-100 px-5 py-4 shadow-sm">
      <div class="stat-title text-xs">已结束</div>
      <div class="stat-value text-2xl text-base-content/40">{{ counts.ended }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ActivityStatusCounts } from '@/services/activity'

defineProps<{
  counts: ActivityStatusCounts
}>()
</script>
