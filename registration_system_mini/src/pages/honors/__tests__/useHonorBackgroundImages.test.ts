const {expect,test,mock,afterEach}:any=await import("bun:test");
import { ref,nextTick,effectScope } from "vue";
import { HONOR_BACKGROUNDS } from "@/config/honorBackgrounds";
const requests:string[]=[],finish=new Map<string,(path:string)=>void>();
mock.module("@/utils/honorBackgroundCache",()=>({resolveHonorBackgroundImage:(url:string)=>{
 requests.push(url);return new Promise<string>(resolve=>{finish.set(url,resolve);});
}}));
const {useHonorBackgroundImages}=await import("../useHonorBackgroundImages");
let scope=effectScope();
afterEach(()=>{scope.stop();requests.length=0;finish.clear();});
function page(self=false){
 scope=effectScope();const bg=ref(HONOR_BACKGROUNDS[0]!),own=ref(self),ready=ref(false);
 const images=scope.run(()=>useHonorBackgroundImages(bg,own,ready))!;
 return {...images,bg,own,ready};
}
test("a recipient only downloads the linked background after the honor is loaded",async()=>{
 const images=page();expect(requests).toEqual([]);
 images.bg.value=HONOR_BACKGROUNDS[2]!;images.ready.value=true;await nextTick();
 expect(requests).toEqual([HONOR_BACKGROUNDS[2]!.imageUrl]);
});
test("picker loads three thumbnails and only the selected full-size image",async()=>{
 const images=page();images.ready.value=true;images.own.value=true;await nextTick();
 expect(requests).toEqual([HONOR_BACKGROUNDS[0]!.imageUrl,...HONOR_BACKGROUNDS.map(bg=>bg.thumbnailUrl)]);
 images.bg.value=HONOR_BACKGROUNDS[1]!;await nextTick();
 expect(requests.at(-1)).toBe(HONOR_BACKGROUNDS[1]!.imageUrl);expect(requests).toHaveLength(5);
});
test("a delayed download cannot replace a newer selected background or an unloaded page",async()=>{
 const images=page();images.ready.value=true;await nextTick();
 images.bg.value=HONOR_BACKGROUNDS[2]!;await nextTick();
 finish.get(HONOR_BACKGROUNDS[0]!.imageUrl)!("old.jpg");await nextTick();expect(images.backgroundImageUrl.value).toBe("");
 scope.stop();finish.get(HONOR_BACKGROUNDS[2]!.imageUrl)!("night.jpg");await nextTick();
 expect(images.backgroundImageUrl.value).toBe("");
});
