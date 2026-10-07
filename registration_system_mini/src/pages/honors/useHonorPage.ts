import { computed, nextTick, ref, watch } from "vue";
import { onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import { hasManualLogout } from "@/utils/authStorage";
import { issueHonorShare, resolveHonorShare, getHonorMiniCode, type HonorShare } from "@/api/honors";
import { joinTeam } from "@/api/team";
import { HONOR_BACKGROUNDS, readHonorBackground, rememberHonorBackground, type HonorBackground } from "@/config/honorBackgrounds";
import { useTeamContext } from "@/stores/teamContext";
import { useMiniReviewStatus } from "@/stores/miniReview";
import { useProfileCompletionGate } from "@/pages/teams/useProfileCompletionGate";
import { composeHonorImage } from "@/utils/honorPosterCompose";
import { formatHonorPoints, honorSharePath, resolveHonorSource, type HonorSource } from "./honorState";

export function useHonorPage(pageInstance: unknown) {
 const context=useTeamContext();
 const { shouldHideCreationEntrances }=useMiniReviewStatus();
 const profileGate=useProfileCompletionGate();
 const view=ref<HonorShare|null>(null),loading=ref(true),error=ref("");
 const background=ref<HonorBackground>(readHonorBackground());
 const coverUrl=ref(""),miniCodeUrl=ref(""),codeError=ref(""),codeLoading=ref(false),saving=ref(false),joining=ref(false),joined=ref(false),password=ref("");
 const isSelf=computed(()=>!!view.value && view.value.user_id===context.currentUser.value?.id);
 const shareReady=computed(()=>!!view.value && !loading.value && !error.value);
 const canCreate=computed(()=>!shouldHideCreationEntrances.value);
 let successUserId:number|undefined;
 let source:HonorSource|null=null,loadVersion=0,renderVersion=0,codeVersion=0,disposed=false;
 let renderQueue:Promise<unknown>=Promise.resolve();
 let codePromise:Promise<string>|null=null;
 function hideSharing() { uni.hideShareMenu({hideShareItems:["shareAppMessage","shareTimeline"]}); }
 function reset() {
  successUserId=undefined;codeLoading.value=false;
  view.value=null;coverUrl.value="";miniCodeUrl.value="";codeError.value="";password.value="";joined.value=false;
  renderVersion++;codeVersion++;codePromise=null;hideSharing();
 }
 function enqueue<T>(action:()=>Promise<T>):Promise<T> {
  const task=renderQueue.catch(()=>undefined).then(action);renderQueue=task;return task;
 }
 async function prepareCover() {
  const record=view.value;if(!record)return;
  const version=++renderVersion,bg=background.value,owner=context.currentUser.value?.id;
  coverUrl.value=bg.imageUrl;
  // H5 does not have native WeChat forwarding; do not prepare a native card there.
  // #ifdef MP-WEIXIN
  try {
   await nextTick();
   const path=await enqueue(()=>composeHonorImage("honor-card-canvas",pageInstance,record,bg,"card",null,
    ()=>!disposed && version===renderVersion && record.code===view.value?.code && owner===context.currentUser.value?.id));
   if(version===renderVersion)coverUrl.value=path;
  } catch { /* Native share keeps a valid static backdrop and descriptive title. */ }
  // #endif
 }
 async function load() {
  const version=++loadVersion;reset();loading.value=true;error.value="";
  try {
   if(!source)throw new Error("荣誉分享链接无效");
   await context.ensureSessionReady();
   const actor=context.currentUser.value?.id;
   const result="code" in source ? await resolveHonorShare(source.code) : await issueHonorShare(source.teamId);
   if(disposed || version!==loadVersion || actor!==context.currentUser.value?.id)return;
   view.value=result;
   uni.showShareMenu({withShareTicket:true,menus:["shareAppMessage","shareTimeline"]});
   void prepareCover();
   if(isSelf.value)void ensureMiniCode().catch(()=>undefined);
  } catch(failure) {
   if(!disposed && version===loadVersion)error.value=failure instanceof Error?failure.message:"打开荣誉失败";
  } finally { if(version===loadVersion)loading.value=false; }
 }
 function environment(): "release"|"trial"|"develop" {
  // #ifdef MP-WEIXIN
  const env=uni.getAccountInfoSync().miniProgram.envVersion;
  if(env==="develop" || env==="trial")return env;
  // #endif
  return "release";
 }
 async function ensureMiniCode():Promise<string> {
  if(miniCodeUrl.value)return miniCodeUrl.value;
  if(codePromise)return codePromise;
  const record=view.value,actor=context.currentUser.value?.id;
  if(!record || !isSelf.value)throw new Error("只能生成自己的荣誉海报");
  const version=++codeVersion;
  codeLoading.value=true;codeError.value="";
  codePromise=(async()=>{
   try {
    const result=await getHonorMiniCode(record.code,environment());
    if(disposed || version!==codeVersion || view.value?.code!==record.code || actor!==context.currentUser.value?.id)throw new Error("登录状态已变化，请重试");
    miniCodeUrl.value=result.image_url;return result.image_url;
   } catch(failure) {
    if(version===codeVersion)codeError.value=failure instanceof Error?failure.message:"小程序码生成失败，请重试";
    throw failure;
   } finally { if(version===codeVersion){codeLoading.value=false;codePromise=null;} }
  })();
  return codePromise;
 }
 function chooseBackground(item:HonorBackground) {
  if(!isSelf.value || background.value.id===item.id)return;
  background.value=item;rememberHonorBackground(item.id);void prepareCover();
 }
 async function savePoster() {
  if(saving.value || !isSelf.value || !view.value)return;
  saving.value=true;
  try {
   await load();
   const record=view.value,actor=context.currentUser.value?.id,bg=background.value;
   if(!record || !isSelf.value || error.value)throw new Error(error.value || "荣誉已变化，请重新打开");
   const version=loadVersion;
   const code=await ensureMiniCode();
   const current=()=>version===loadVersion && !disposed && record.code===view.value?.code && actor===context.currentUser.value?.id && bg.id===background.value.id;
   await nextTick();
   const path=await enqueue(()=>composeHonorImage("honor-poster-canvas",pageInstance,record,bg,"poster",code,current));
   if(!current())throw new Error("海报内容已更新，请重新保存");
   // #ifdef MP-WEIXIN
   await new Promise<void>((resolve,reject)=>uni.saveImageToPhotosAlbum({filePath:path,success:()=>resolve(),fail:reject}));
   uni.showToast({title:"海报已保存到相册",icon:"success"});
   // #endif
   // #ifdef H5
   uni.previewImage({urls:[path],current:path});
   // #endif
  } catch(failure) {
   const detail=failure && typeof failure==="object" && "errMsg" in failure?String(failure.errMsg):"";
   if(/auth|deny|denied/i.test(detail)) {
    uni.showModal({title:"需要相册权限",content:"允许保存到相册后，可以再次保存这张海报。",confirmText:"去设置",success:result=>{if(result.confirm)uni.openSetting({});}});
   } else uni.showToast({title:failure instanceof Error?failure.message:"海报保存失败，请重试",icon:"none"});
  } finally {saving.value=false;}
 }
 async function join() {
  const record=view.value,actor=context.currentUser.value?.id,version=loadVersion;
  if(!record || !actor || joining.value || joined.value || record.is_member)return;
  if(record.requires_password && !password.value.trim()){uni.showToast({title:"请输入入队密码",icon:"none"});return;}
  joining.value=true;
  try {
   if(!(await profileGate.ensureProfileComplete()))return;
   if(disposed || actor!==context.currentUser.value?.id || version!==loadVersion)return;
   await joinTeam({team_id:record.team_id,password:password.value.trim() || undefined});
   if(disposed || actor!==context.currentUser.value?.id || version!==loadVersion)return;
   successUserId=actor;joined.value=true;password.value="";
   try {await context.refreshSessionContext();}catch{uni.showToast({title:"已加入球队，列表稍后刷新",icon:"none"});}
  } catch(failure) {uni.showToast({title:failure instanceof Error?failure.message:"加入球队失败",icon:"none"});}
  finally {joining.value=false;}
 }
 async function restoreSuccessAccount():Promise<boolean> {
  const owner=successUserId || context.currentUser.value?.id;
  if(hasManualLogout()){reset();return false;}
  if(!owner)return false;
  try {
   await context.ensureSessionReady();
   if(hasManualLogout() || owner!==context.currentUser.value?.id)return false;
   return true;
  } catch {uni.showToast({title:"已加入球队，请稍后重试",icon:"none"});return false;}
 }
 async function goTeam(){if(view.value && await restoreSuccessAccount())uni.navigateTo({url:`/pages/teams/detail/index?teamId=${view.value.team_id}`});}
 function createTeam(){if(canCreate.value)uni.navigateTo({url:"/pages/teams/create/index"});}
 function goHome(){uni.switchTab({url:"/pages/home/index"});}
 watch(()=>context.currentUser.value?.id,(id,previous)=>{
  if(id===previous)return;
  if(successUserId && !hasManualLogout() && (!id || id===successUserId))return;
  if(!previous && !view.value)return;
  loadVersion++;reset();loading.value=false;error.value="登录状态已变化，请重新打开荣誉";
  profileGate.handleProfileGateCancel();
  if(id)void load();
 });
 onLoad(options=>{hideSharing();source=resolveHonorSource(options??{});void load();});
 onShow(()=>{
  if(disposed || !source || loading.value || saving.value || joining.value)return;
  if(hasManualLogout()){loadVersion++;reset();error.value="请重新登录后打开荣誉";return;}
  if(successUserId && !context.currentUser.value) {
   void restoreSuccessAccount().then(restored=>{if(restored)void load();});
  } else void load();
 });
 onUnload(()=>{disposed=true;loadVersion++;renderVersion++;codeVersion++;});
 const title=computed(()=>view.value?`${view.value.nickname || "球友"}的${view.value.year}足球年度 · ${formatHonorPoints(view.value.participation_points)}分`:"我的足球年度");
 function friendShare(){return {title:title.value,path:view.value?honorSharePath(view.value.code):"/pages/home/index",imageUrl:coverUrl.value || background.value.imageUrl};}
 function timelineShare(){return {title:title.value,query:view.value?`code=${encodeURIComponent(view.value.code)}`:"",imageUrl:coverUrl.value || background.value.imageUrl};}
 return {view,loading,error,background,backgrounds:HONOR_BACKGROUNDS,miniCodeUrl,codeError,codeLoading,saving,isSelf,shareReady,canCreate,password,joining,joined,profileGate,load,ensureMiniCode,chooseBackground,savePoster,join,goTeam,createTeam,goHome,friendShare,timelineShare};
}
