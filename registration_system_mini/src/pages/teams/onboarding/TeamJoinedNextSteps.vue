<script setup lang="ts">
import OnboardingIllustration from "@/components/OnboardingIllustration.vue";
import AppSurface from "@/components/ui/AppSurface.vue";
import AppButton from "@/components/ui/AppButton.vue";
defineProps<{ alreadyMember?: boolean; imageUrl?: string; imageRevision?: number }>();
defineEmits<{ (event: "team"): void; (event: "matches"): void }>();
</script>

<template>
  <AppSurface flush>
    <view class="joined-next">
      <OnboardingIllustration :revision="imageRevision" :src="imageUrl || ''" />
      <text class="joined-next__status">{{ alreadyMember ? "你已是球队成员" : "加入成功" }}</text>
      <text class="joined-next__title">下一步，和队友一起踢球</text>
      <text class="joined-next__copy">首页会显示队内比赛，打开比赛详情即可查看报名安排。也可以去找公开比赛。</text>
      <AppButton block @click="$emit('team')">查看球队</AppButton>
      <AppButton block variant="outline" @click="$emit('matches')">去找比赛</AppButton>
    </view>
  </AppSurface>
</template>

<style scoped>
.joined-next { display: flex; flex-direction: column; gap: 20rpx; padding: 28rpx; }
.joined-next__status { color: var(--ui-color-success-fg); font-size: 24rpx; font-weight: 600; }
.joined-next__title { color: var(--ui-color-text); font-size: 32rpx; font-weight: 600; }
.joined-next__copy { color: var(--ui-color-text-muted); font-size: 24rpx; line-height: 1.6; }
</style>
