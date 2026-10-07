export {};
const { expect,test,mock,afterEach }:any=await import("bun:test");
const {ref,nextTick,effectScope}=await import("vue");
const user=ref<{id:number}|null>({id:4});
let onLoadCallback:(options:any)=>void,onShowCallback:(()=>void)|undefined;
let sessionActor=4,issues=0,resolves=0,codes=0,exports=0,joinedRequests=0,refreshFails=false,manualLogout=false,revoked=false;
let pendingHonor:Promise<typeof record>|null=null;
const albumFiles:string[]=[];
let posterRecord:typeof record|undefined;
let posterExports=0,posterBackground="",failPoster=false;
let pendingPoster:Promise<string>|null=null;
const actualNow=Date.now;
let storedBackground="pitch";
const record={code:"abcdefghijklmnopqrstuv",team_id:11,user_id:4,year:2026,nickname:"球友",team_name:"球队",participation_points:259,participation_rank:4,is_paid_member:false,is_member:false,requires_password:false};
mock.module("@dcloudio/uni-app",()=>({onLoad:(fn:any)=>onLoadCallback=fn,onShow:(fn:any)=>onShowCallback=fn,onUnload:()=>undefined,onShareAppMessage:()=>undefined,onShareTimeline:()=>undefined}));
mock.module("@/api/honors",()=>({issueHonorShare:async()=>{issues++;if(revoked)throw new Error("分享已失效");if(pendingHonor)return pendingHonor;return {...record};},resolveHonorShare:async()=>{resolves++;if(revoked)throw new Error("分享已失效");return {...record};},getHonorMiniCode:async()=>{codes++;return {image_url:"actual-code.png"};}}));
mock.module("@/api/team",()=>({joinTeam:async()=>{joinedRequests++;}}));
mock.module("@/utils/authStorage",()=>({hasManualLogout:()=>manualLogout}));
mock.module("@/stores/teamContext",()=>({useTeamContext:()=>({currentUser:user,ensureSessionReady:async()=>{user.value={id:sessionActor};},refreshSessionContext:async()=>{if(refreshFails){user.value=null;await nextTick();throw new Error("network");}}})}));
mock.module("@/stores/miniReview",()=>({useMiniReviewStatus:()=>({shouldHideCreationEntrances:ref(false)})}));
mock.module("@/pages/teams/useProfileCompletionGate",()=>({useProfileCompletionGate:()=>({ensureProfileComplete:async()=>true,handleProfileGateCancel:()=>undefined})}));
mock.module("@/utils/honorPosterCompose",()=>({createHonorImageLoader:()=>({load:()=>undefined,clear:()=>undefined}),composeHonorImage:async(_canvas:any,_page:any,view:any,background:any,kind:string)=>{exports++;if(kind==="poster"){posterExports++;posterRecord=view;posterBackground=background.id;if(failPoster)throw new Error("图片生成失败");if(pendingPoster)return pendingPoster;}return "poster.jpg";}}));
const {useHonorPage}=await import("../useHonorPage");
let scope=effectScope();
function makePage(options:any){scope=effectScope();const page=scope.run(()=>useHonorPage(null))!;onLoadCallback(options);return page;}
async function flush(){for(let i=0;i<8;i++)await new Promise(resolve=>setTimeout(resolve,0));}
afterEach(()=>{scope.stop();sessionActor=4;user.value={id:4};issues=resolves=codes=exports=joinedRequests=posterExports=0;refreshFails=manualLogout=revoked=failPoster=false;onShowCallback=undefined;pendingHonor=pendingPoster=null;albumFiles.length=0;posterRecord=undefined;posterBackground="";storedBackground="pitch";Date.now=actualNow;});
(globalThis as unknown as {uni:typeof uni}).uni={getStorageSync:()=>storedBackground,setStorageSync:(_key:string,value:string)=>{storedBackground=value;},hideShareMenu:()=>undefined,showShareMenu:()=>undefined,getAccountInfoSync:()=>({miniProgram:{envVersion:"develop"}}),saveImageToPhotosAlbum:({filePath,success}:any)=>{albumFiles.push(filePath);success();},previewImage:()=>undefined,showToast:()=>undefined} as unknown as typeof uni;
test("returning to own page refreshes current year, code links preserve their source",async()=>{
 makePage({teamId:"11"});await flush();const before=issues;
 expect(onShowCallback).toBeDefined();onShowCallback!();await flush();expect(issues).toBe(before+1);
});
test("save uses the loaded snapshot without fetching honor data again",async()=>{
 const page=makePage({teamId:"11"});await flush();const before=exports,displayed=page.view.value;revoked=true;
 await page.savePoster();expect(issues).toBe(1);expect(exports).toBe(before);
 expect(page.view.value).toBe(displayed);expect(page.loading.value).toBe(false);expect(page.error.value).toBe("");
 expect(albumFiles).toEqual(["poster.jpg"]);
});
test("confirmed join survives refresh failure but active logout clears it",async()=>{
 record.user_id=5;
 const page=makePage({code:record.code});await flush();refreshFails=true;await page.join();
 expect(joinedRequests).toBe(1);expect(page.joined.value).toBe(true);expect(page.view.value).not.toBeNull();
 manualLogout=true;onShowCallback!();await flush();expect(page.joined.value).toBe(false);
 record.user_id=4;
});
test("shared link opens the sharer's honor for a different user without issuing their own",async()=>{
 const owner=makePage({teamId:"11"});await flush();
 owner.chooseBackground(owner.backgrounds[2]!);await flush();
 const share=owner.friendShare();
 expect(share.path).toBe("/pages/honors/index?code="+record.code+"&background=night");
 expect(owner.timelineShare().query).toBe("code="+record.code+"&background=night");
 scope.stop();sessionActor=99;user.value={id:99};storedBackground="pitch";
 const query=new URLSearchParams(share.path.split("?")[1]);
 const recipient=makePage({code:query.get("code"),background:query.get("background")});await flush();
 expect(issues).toBe(1);expect(resolves).toBe(1);
 expect(recipient.view.value?.user_id).toBe(4);expect(recipient.isSelf.value).toBe(false);
 expect(recipient.background.value.id).toBe("night");
 expect(codes).toBe(1);
});
test("incoming background is validated without changing the owner's stored preference",async()=>{
 sessionActor=99;user.value={id:99};storedBackground="gold";
 const recipient=makePage({code:record.code,background:"https://untrusted.example/image.png"});await flush();
 expect(recipient.background.value.id).toBe("pitch");expect(resolves).toBe(1);
 scope.stop();sessionActor=4;user.value={id:4};
 const own=makePage({teamId:"11"});await flush();expect(own.background.value.id).toBe("gold");
});
test("saving preserves the displayed score even if a newer score is available",async()=>{
 const page=makePage({teamId:"11"});await flush();
 const displayed=page.view.value,bg=page.background.value,codeUrl=page.miniCodeUrl.value;
 pendingHonor=Promise.resolve({...record,participation_points:260.2});
 const saving=page.savePoster();await nextTick();
 expect(page.saving.value).toBe(true);expect(page.loading.value).toBe(false);
 expect(page.view.value).toBe(displayed);expect(page.background.value).toBe(bg);
 expect(page.miniCodeUrl.value).toBe(codeUrl);expect(page.shareReady.value).toBe(true);
 await saving;
 expect(page.saving.value).toBe(false);expect(page.loading.value).toBe(false);
 expect(page.view.value?.participation_points).toBe(259);
 expect(posterRecord?.participation_points).toBe(259);expect(issues).toBe(1);
 expect(albumFiles).toEqual(["poster.jpg"]);expect(codes).toBe(1);
});
test("saving after annual rollover keeps the shown year until the page is refreshed",async()=>{
 const page=makePage({teamId:"11"});await flush();
 const nextYear={...record,code:"zyxwvutsrqponmlkjihgfe",year:2027,participation_points:0};
 pendingHonor=Promise.resolve(nextYear);
 await page.savePoster();
 expect(page.view.value?.year).toBe(2026);expect(posterRecord?.year).toBe(2026);expect(codes).toBe(1);expect(issues).toBe(1);
 expect(albumFiles).toEqual(["poster.jpg"]);expect(page.loading.value).toBe(false);
 await page.load();await flush();
 expect(page.view.value?.year).toBe(2027);expect(page.view.value?.code).toBe(nextYear.code);
 expect(posterRecord?.year).toBe(2027);expect(codes).toBe(2);
});
test("page prepares the poster before a click and repeated saves reuse it without network requests",async()=>{
 const page=makePage({teamId:"11"});await flush();
 expect(posterExports).toBe(1);const before=exports;
 await page.savePoster();await page.savePoster();await flush();
 expect(posterExports).toBe(1);expect(exports).toBe(before);expect(issues).toBe(1);expect(codes).toBe(1);
 expect(albumFiles).toEqual(["poster.jpg","poster.jpg"]);
});
test("changing a background prepares its poster and saving uses that prepared image",async()=>{
 const page=makePage({teamId:"11"});await flush();
 page.chooseBackground(page.backgrounds[1]!);await flush();
 expect(posterExports).toBe(2);expect(posterBackground).toBe("gold");
 await page.savePoster();expect(posterExports).toBe(2);expect(albumFiles).toEqual(["poster.jpg"]);
});
test("a failed background preparation can be retried by saving",async()=>{
 failPoster=true;const page=makePage({teamId:"11"});await flush();
 expect(posterExports).toBe(1);failPoster=false;
 await page.savePoster();expect(posterExports).toBe(2);expect(albumFiles).toEqual(["poster.jpg"]);
});
test("an account change during save never exports the previous user's prepared image",async()=>{
 let finish!:(value:string)=>void;pendingPoster=new Promise(resolve=>{finish=resolve;});
 const page=makePage({teamId:"11"});await flush();
 const saving=page.savePoster();await nextTick();sessionActor=99;user.value={id:99};await nextTick();
 finish("poster.jpg");await saving;await flush();expect(albumFiles).toEqual([]);
});
test("saving while preparation is pending waits for the same export",async()=>{
 let finish!:(value:string)=>void;pendingPoster=new Promise(resolve=>{finish=resolve;});
 const page=makePage({teamId:"11"});await flush();expect(posterExports).toBe(1);
 const saving=page.savePoster();await flush();expect(posterExports).toBe(1);expect(albumFiles).toEqual([]);
 finish("poster.jpg");await saving;expect(albumFiles).toEqual(["poster.jpg"]);
});
test("the Beijing record date changing invalidates a prepared poster",async()=>{
 Date.now=()=>Date.parse("2026-10-07T15:59:00Z");
 const page=makePage({teamId:"11"});await flush();expect(posterExports).toBe(1);
 Date.now=()=>Date.parse("2026-10-07T16:01:00Z");
 await page.savePoster();expect(posterExports).toBe(2);expect(albumFiles).toEqual(["poster.jpg"]);
});
