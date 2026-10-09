<script setup lang="ts">
import { useMinioImages } from "@/composables/useMinioImages";
import { computed,ref,watch } from "vue";
import type { HonorShare } from "@/api/honors";
import type { HonorBackground } from "@/config/honorBackgrounds";
import MembershipCrown from "@/components/ui/MembershipCrown.vue";
import { formatHonorPoints,honorTitle } from "../honorState";

const { minioImageSrc } = useMinioImages();
const props=defineProps<{ view:HonorShare; background:HonorBackground; backgroundImageUrl:string; miniCodeUrl?:string; showCode?:boolean; codeLoading?:boolean }>();
const avatarFailed=ref(false),backgroundFailed=ref(false);
watch(()=>props.view.avatar_url,()=>avatarFailed.value=false);
watch(()=>props.background.id,()=>backgroundFailed.value=false);
const title=computed(()=>honorTitle(props.view.participation_points,props.view.participation_rank));
const backgroundStyle=computed(()=>({color:props.background.textColor,backgroundColor:props.background.id==="night"?"#041322":"#f7f8ed"}));
</script>
<template>
 <view class="honor-poster" :style="backgroundStyle">
  <image v-if="backgroundImageUrl" class="honor-poster-background" :src="backgroundImageUrl" mode="aspectFill" @error="backgroundFailed=true" />
  <text class="honor-poster-year">{{view.year}} · 我的足球年度</text>
  <view class="honor-poster-avatar" :class="{'honor-poster-avatar--member':view.is_paid_member}">
   <image v-if="view.avatar_url && !avatarFailed" :src="minioImageSrc(view.avatar_url)" mode="aspectFill" @error="minioImageSrc(view.avatar_url) && (avatarFailed=true)" />
   <text v-else>{{Array.from(view.nickname || '球友')[0]}}</text>
  </view>
  <view v-if="view.is_paid_member" class="honor-poster-crown"><MembershipCrown width="44rpx" height="26rpx" /></view>
  <text class="honor-poster-name">{{view.nickname || '球友'}}</text>
  <text class="honor-poster-team">{{view.team_name}}</text>
  <text class="honor-poster-label">年度参与星</text>
  <view class="honor-poster-points"><text>{{formatHonorPoints(view.participation_points)}}</text><text class="honor-poster-unit">星</text></view>
  <text v-if="title" class="honor-poster-honor">{{title}}</text>
  <text class="honor-poster-motto" :class="{'honor-poster-motto--without-honor':!title}">每一次参与，都值得记录</text>
  <view v-if="showCode" class="honor-poster-scan">
   <image v-if="miniCodeUrl" class="honor-poster-code" :src="minioImageSrc(miniCodeUrl)" mode="aspectFit" />
   <view v-else class="honor-poster-code honor-poster-code--pending"><text>{{codeLoading ? '正在生成' : '待生成'}}<br />小程序码</text></view>
   <view class="honor-poster-scan-copy"><text class="honor-poster-scan-title">扫码看我的荣誉</text><text class="honor-poster-scan-caption">加入球队 · 创建自己的球队</text></view>
  </view>
  <text v-if="backgroundFailed" class="honor-poster-image-error">背景暂时无法加载</text>
 </view>
</template>
<style scoped>
/* Poster is a fixed graphic asset. Its intrinsic text/QR colors are independent of app theme. */
.honor-poster{position:relative;width:560rpx;max-width:100%;height:840rpx;overflow:hidden;box-shadow:var(--ui-shadow-card);border-radius:var(--ui-radius-button)}
.honor-poster-background{position:absolute;inset:0;width:100%;height:100%}
.honor-poster-year,.honor-poster-name,.honor-poster-team,.honor-poster-label,.honor-poster-honor,.honor-poster-motto{position:absolute;left:14%;width:72%;display:block;text-align:center;line-height:1.4}
.honor-poster-year{top:14%;font-size:20rpx;letter-spacing:3rpx;opacity:.8}
.honor-poster-avatar{position:absolute;top:20.5%;left:41%;width:18%;height:12%;border:3rpx solid #fff;border-radius:20rpx;box-sizing:border-box;overflow:hidden;background:#e8f5ee;display:flex;align-items:center;justify-content:center;color:#226342;font-size:42rpx}
.honor-poster-avatar--member{border-color:#d1ad5c}.honor-poster-avatar image{width:100%;height:100%}.honor-poster-crown{position:absolute;top:17.8%;left:calc(50% - 22rpx)}
.honor-poster-name{top:34%;max-height:9%;font-size:28rpx;font-weight:600;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow-wrap:anywhere}
.honor-poster-team{top:43.5%;font-size:18rpx;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;opacity:.8}
.honor-poster-label{top:46%;font-size:20rpx;opacity:.8}
.honor-poster-points{position:absolute;top:50%;left:8%;width:84%;text-align:center;font-size:82rpx;font-weight:600;line-height:1.3;font-variant-numeric:tabular-nums}
.honor-poster-unit{font-size:22rpx;font-weight:400;margin-left:10rpx}.honor-poster-honor{top:61%;font-size:20rpx;font-weight:600}
.honor-poster-motto{top:65%;font-size:18rpx}.honor-poster-motto--without-honor{top:62%}
.honor-poster-scan{position:absolute;top:70.3%;left:14%;width:72%;height:17%;box-sizing:border-box;padding:10rpx;background:#fff;color:#00214d;border-radius:16rpx;display:flex;align-items:center;gap:16rpx}
.honor-poster-code{width:120rpx;height:120rpx;flex-shrink:0}.honor-poster-code--pending{font-size:16rpx;color:#526174;display:flex;align-items:center;justify-content:center;text-align:center;background:#f0f2f5;border-radius:12rpx}
.honor-poster-scan-copy{min-width:0;display:flex;flex-direction:column;gap:10rpx}.honor-poster-scan-title{font-size:22rpx;font-weight:600}.honor-poster-scan-caption{font-size:15rpx;line-height:1.5;color:#526174}
.honor-poster-image-error{position:absolute;bottom:20rpx;left:0;width:100%;text-align:center;font-size:18rpx}
</style>
