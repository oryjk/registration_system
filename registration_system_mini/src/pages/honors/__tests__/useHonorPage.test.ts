export {};
const { expect,test,mock,afterEach }:any=await import("bun:test");
const {ref,nextTick,effectScope}=await import("vue");
const user=ref<{id:number}|null>({id:4});
let onLoadCallback:(options:any)=>void,onShowCallback:(()=>void)|undefined;
let issues=0,resolves=0,codes=0,exports=0,joinedRequests=0,refreshFails=false,manualLogout=false,revoked=false;
const record={code:"abcdefghijklmnopqrstuv",team_id:11,user_id:4,year:2026,nickname:"球友",team_name:"球队",participation_points:259,participation_rank:4,is_paid_member:false,is_member:false,requires_password:false};
mock.module("@dcloudio/uni-app",()=>({onLoad:(fn:any)=>onLoadCallback=fn,onShow:(fn:any)=>onShowCallback=fn,onUnload:()=>undefined,onShareAppMessage:()=>undefined,onShareTimeline:()=>undefined}));
mock.module("@/api/honors",()=>({issueHonorShare:async()=>{issues++;if(revoked)throw new Error("分享已失效");return {...record};},resolveHonorShare:async()=>{resolves++;if(revoked)throw new Error("分享已失效");return {...record};},getHonorMiniCode:async()=>{codes++;return {image_url:"actual-code.png"};}}));
mock.module("@/api/team",()=>({joinTeam:async()=>{joinedRequests++;}}));
mock.module("@/utils/authStorage",()=>({hasManualLogout:()=>manualLogout}));
mock.module("@/stores/teamContext",()=>({useTeamContext:()=>({currentUser:user,ensureSessionReady:async()=>{user.value={id:4};},refreshSessionContext:async()=>{if(refreshFails){user.value=null;await nextTick();throw new Error("network");}}})}));
mock.module("@/stores/miniReview",()=>({useMiniReviewStatus:()=>({shouldHideCreationEntrances:ref(false)})}));
mock.module("@/pages/teams/useProfileCompletionGate",()=>({useProfileCompletionGate:()=>({ensureProfileComplete:async()=>true,handleProfileGateCancel:()=>undefined})}));
mock.module("@/utils/honorPosterCompose",()=>({composeHonorImage:async()=>{exports++;return "poster.jpg";}}));
const {useHonorPage}=await import("../useHonorPage");
let scope=effectScope();
function makePage(options:any){scope=effectScope();const page=scope.run(()=>useHonorPage(null))!;onLoadCallback(options);return page;}
async function flush(){for(let i=0;i<8;i++)await new Promise(resolve=>setTimeout(resolve,0));}
afterEach(()=>{scope.stop();user.value={id:4};issues=resolves=codes=exports=joinedRequests=0;refreshFails=manualLogout=revoked=false;onShowCallback=undefined;});
(globalThis as unknown as {uni:typeof uni}).uni={getStorageSync:()=>"pitch",hideShareMenu:()=>undefined,showShareMenu:()=>undefined,getAccountInfoSync:()=>({miniProgram:{envVersion:"develop"}}),saveImageToPhotosAlbum:({success}:any)=>success(),previewImage:()=>undefined,showToast:()=>undefined} as unknown as typeof uni;
test("returning to own page refreshes current year, code links preserve their source",async()=>{
 makePage({teamId:"11"});await flush();const before=issues;
 expect(onShowCallback).toBeDefined();onShowCallback!();await flush();expect(issues).toBe(before+1);
});
test("save revalidates cached data and refuses a revoked share",async()=>{
 const page=makePage({teamId:"11"});await flush();const before=exports;revoked=true;
 await page.savePoster();expect(issues).toBe(2);expect(exports).toBe(before);
});
test("confirmed join survives refresh failure but active logout clears it",async()=>{
 record.user_id=5;
 const page=makePage({code:record.code});await flush();refreshFails=true;await page.join();
 expect(joinedRequests).toBe(1);expect(page.joined.value).toBe(true);expect(page.view.value).not.toBeNull();
 manualLogout=true;onShowCallback!();await flush();expect(page.joined.value).toBe(false);
 record.user_id=4;
});
