<script setup lang="ts">
import AppPageIntro from "@/components/ui/AppPageIntro.vue";
import { HOME_VISUAL_ASSETS } from "@/config/homeVisualAssets";
</script>

<template>
  <view class="team-create-intro">
    <AppPageIntro title="组建你的球队" description="创建后你将成为队长，可邀请队友加入。" :image-url="HOME_VISUAL_ASSETS.createTeam" :background-url="HOME_VISUAL_ASSETS.hero" tone="hero" />
  </view>
</template>

<style scoped>
.team-create-intro { margin-bottom: var(--ui-section-gap); }
</style>
