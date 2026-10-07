<script setup lang="ts">
import { computed,getCurrentInstance } from "vue";
import AppTabHeader from "@/components/AppTabHeader.vue";
import AppButton from "@/components/ui/AppButton.vue";
import AppSurface from "@/components/ui/AppSurface.vue";
import ProfileCompletionDialog from "@/components/ProfileCompletionDialog.vue";
import RunningLoader from "@/components/ui/RunningLoader.vue";
import { useAccentTheme } from "@/stores/theme";
import { getCustomNavMetrics } from "@/utils/customNav";
import { useHonorPage } from "./useHonorPage";
import HonorPoster from "./components/HonorPoster.vue";
const {themePageStyle}=useAccentTheme();
const metrics=getCustomNavMetrics();
const pageStyle=computed(()=>({paddingTop:`${metrics.pageTopPadding+8}px`}));
const {view,loading,error,background,backgrounds,miniCodeUrl,codeError,codeLoading,saving,isSelf,shareReady,canCreate,password,joining,joined,profileGate,load,ensureMiniCode,chooseBackground,savePoster,join,goTeam,createTeam,goHome}=useHonorPage(getCurrentInstance()?.proxy);
function shareInMini(){uni.showModal({title:"分享我的荣誉",content:"请在微信小程序中打开，可发给朋友或保存海报。",showCancel:false});}
</script>
<template>
 <page-meta :page-style="themePageStyle" />
 <view class="app-theme-scope honor-page" :style="[themePageStyle,pageStyle]">
  <AppTabHeader :title="isSelf ? '分享我的荣誉' : '足球年度荣誉'" showBack />
  <RunningLoader v-if="loading" text="正在打开荣誉" />
  <AppSurface v-else-if="error" custom-class="honor-error">
   <view class="honor-error-copy"><text>{{error}}</text><AppButton block @click="load">重新打开</AppButton><AppButton block variant="outline" @click="goHome">回到首页</AppButton></view>
  </AppSurface>
  <template v-else-if="view">
   <view class="honor-intro"><text class="honor-intro-title">{{isSelf ? '为每一次参与，留下纪念' : view.nickname+'的足球年度'}}</text><text class="honor-intro-caption">{{isSelf ? '选一款喜欢的背景，把这份热爱分享出去。' : '一起踢球，也一起积累属于球队的荣誉。'}}</text></view>
   <view class="honor-poster-stage"><HonorPoster :view="view" :background="background" :mini-code-url="miniCodeUrl" :show-code="isSelf" :code-loading="codeLoading" /></view>
   <view v-if="isSelf" class="honor-picker">
    <text class="honor-section-title">选择海报背景</text>
    <view class="honor-backgrounds">
     <button v-for="item in backgrounds" :key="item.id" class="honor-background" :class="{'honor-background--selected':background.id===item.id}" :disabled="saving" :aria-label="item.name+'，免费'" :aria-pressed="background.id===item.id" @tap="chooseBackground(item)">
      <image :src="item.imageUrl" mode="aspectFill" /><text>{{item.name}}</text><text class="honor-background-free">免费</text>
     </button>
    </view>
    <view v-if="codeError" class="honor-code-error"><text>{{codeError}}</text><AppButton size="sm" variant="outline" :loading="codeLoading" @click="ensureMiniCode().catch(()=>undefined)">重新生成</AppButton></view>
    <view class="honor-actions">
     <!-- #ifdef MP-WEIXIN -->
     <button class="honor-share-button" open-type="share" :disabled="!shareReady || saving">发给朋友</button>
     <!-- #endif -->
     <!-- #ifdef H5 -->
     <AppButton block variant="outline" @click="shareInMini">发给朋友</AppButton>
     <!-- #endif -->
     <AppButton block :loading="saving" :disabled="saving || !shareReady" @click="savePoster">{{saving ? '正在保存' : '保存海报'}}</AppButton>
    </view>
    <text class="honor-footnote">保存到相册后可分享朋友圈。积分与荣誉以当前统计为准。</text>
   </view>
   <AppSurface v-else variant="raised" custom-class="honor-join-card">
    <view class="honor-card-content"><text class="honor-section-title">{{view.team_name}}</text><text class="honor-card-copy">{{view.team_description || '和这支球队一起报名比赛，记录每一次参与。'}}</text>
     <template v-if="!view.is_member && !joined">
      <input v-if="view.requires_password" v-model="password" class="honor-password" password type="safe-password" placeholder="请输入入队密码" :disabled="joining" />
      <AppButton block :loading="joining" :disabled="joining || (view.requires_password && !password.trim())" @click="join">加入这支球队</AppButton>
     </template>
     <AppButton v-else block @click="goTeam">{{joined ? '已加入，查看球队' : '查看这支球队'}}</AppButton>
    </view>
   </AppSurface>
   <AppSurface v-if="!isSelf && canCreate" variant="outlined" custom-class="honor-create-card">
    <view class="honor-card-content"><text class="honor-section-title">把你的球队也带来</text><text class="honor-card-copy">比赛报名、队员管理、年度荣誉，让每一次参与都有记录。</text><AppButton block variant="outline" @click="createTeam">创建我的球队</AppButton></view>
   </AppSurface>
   <view v-if="!isSelf" class="honor-home-link" @tap="goHome"><text>去首页看看更多比赛</text></view>
  </template>
  <ProfileCompletionDialog :visible="profileGate.profileGateVisible.value" @completed="profileGate.handleProfileGateCompleted" @cancel="profileGate.handleProfileGateCancel" />
  <canvas id="honor-poster-canvas" canvas-id="honor-poster-canvas" class="honor-canvas honor-canvas--poster" />
  <canvas id="honor-card-canvas" canvas-id="honor-card-canvas" class="honor-canvas honor-canvas--card" />
 </view>
</template>
<style scoped>
.honor-page{min-height:100vh;padding:0 28rpx 80rpx;background:var(--ui-color-page);box-sizing:border-box}
.honor-intro{display:flex;flex-direction:column;gap:12rpx;margin:14rpx 0 24rpx}
.honor-intro-title{font-size:34rpx;font-weight:var(--ui-font-weight-heading);color:var(--ui-color-text)}
.honor-intro-caption,.honor-card-copy{font-size:24rpx;line-height:1.65;color:var(--ui-color-text-muted)}
.honor-poster-stage{display:flex;justify-content:center;padding:24rpx 12rpx;background:var(--ui-color-neutral-bg);border-radius:var(--ui-radius-card)}
.honor-picker{margin-top:28rpx}.honor-section-title{font-size:30rpx;line-height:1.4;font-weight:var(--ui-font-weight-heading);color:var(--ui-color-text);display:block}
.honor-backgrounds{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16rpx;margin:18rpx 0 26rpx}
.honor-background{margin:0;padding:8rpx 8rpx 14rpx;border:2rpx solid var(--ui-color-line);background:var(--ui-color-surface);border-radius:var(--ui-radius-button);font-size:22rpx;color:var(--ui-color-text);line-height:1.5;display:flex;flex-direction:column;align-items:center;gap:8rpx}
.honor-background::after,.honor-share-button::after{border:0}.honor-background--selected{border-color:var(--ui-color-accent);background:var(--ui-color-accent-soft)}
.honor-background image{width:100%;height:220rpx;border-radius:12rpx}.honor-background-free{font-size:20rpx;color:var(--ui-color-text-muted)}
.honor-actions{display:grid;grid-template-columns:1fr 1fr;gap:16rpx}
.honor-share-button{width:100%;height:88rpx;margin:0;padding:0;display:flex;align-items:center;justify-content:center;border:2rpx solid var(--ui-color-line);border-radius:var(--ui-radius-button);color:var(--ui-color-text);background:var(--ui-color-surface);font-size:30rpx;font-weight:600}
.honor-share-button[disabled]{color:var(--ui-color-text-muted)}.honor-footnote{display:block;margin-top:20rpx;font-size:22rpx;color:var(--ui-color-text-muted);line-height:1.6}
.honor-code-error{display:flex;align-items:center;gap:16rpx;margin-bottom:20rpx;font-size:22rpx;color:var(--ui-color-danger-fg);line-height:1.6}
.honor-card-content,.honor-error-copy{display:flex;flex-direction:column;gap:20rpx}
.honor-join-card,.honor-create-card,.honor-error{margin-top:28rpx}
.honor-password{height:88rpx;padding:0 24rpx;border:2rpx solid var(--ui-color-line);border-radius:var(--ui-radius-button);color:var(--ui-color-text);background:var(--ui-color-surface);font-size:26rpx}
.honor-home-link{text-align:center;margin-top:28rpx;color:var(--ui-color-text-muted);font-size:24rpx;padding:20rpx}
.honor-canvas{position:fixed;left:-4000px;top:0;pointer-events:none}.honor-canvas--poster{width:1024px;height:1536px}.honor-canvas--card{width:1000px;height:800px}
</style>
