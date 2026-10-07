const {expect,test}:any=await import("bun:test");
import pages from "../../../pages.json";
import { composeHonorImage, createHonorImageLoader } from "@/utils/honorPosterCompose";
import { HONOR_BACKGROUNDS } from "@/config/honorBackgrounds";
import type { HonorShare } from "@/api/honors";

test("ordinary launch still opens home, where scene codes are routed", () => {
 expect(pages.pages[0]?.path).toBe("pages/home/index");
});
test("cover and poster reuse downloaded image paths within the page",async()=>{
 const requests:string[]=[];
 const ctx=new Proxy({draw:(_reserve:boolean,done:()=>void)=>done(),measureText:()=>({width:10})},{get:(target,key)=>key in target?target[key as keyof typeof target]:()=>undefined});
 (globalThis as unknown as {uni:typeof uni}).uni={getImageInfo:({src,success}:any)=>{requests.push(src);success({path:src,width:1024,height:1536});},createCanvasContext:()=>ctx,canvasToTempFilePath:({success}:any)=>success({tempFilePath:"poster.jpg"})} as unknown as typeof uni;
 const loader=createHonorImageLoader(),bg=HONOR_BACKGROUNDS[0]!;
 const view={year:2026,nickname:"球友",team_name:"球队",participation_points:259,participation_rank:4,is_paid_member:true,avatar_url:"avatar.png"} as HonorShare;
 await composeHonorImage("card",null,view,bg,"card",null,()=>true,loader.load);
 await composeHonorImage("poster",null,view,bg,"poster","actual-code.png",()=>true,loader.load);
 expect(requests).toEqual([bg.imageUrl,"avatar.png","/static/icons/lucide/member-crown.png","actual-code.png"]);
});
test("image loading coalesces pending requests, retries failures and clears on page reset",async()=>{
 let requests=0,finish:any;
 (globalThis as unknown as {uni:typeof uni}).uni={getImageInfo:(options:any)=>{requests++;finish=options;}} as unknown as typeof uni;
 const loader=createHonorImageLoader(),first=loader.load("background.png"),second=loader.load("background.png");
 await Promise.resolve();
 expect(first).toBe(second);expect(requests).toBe(1);
 finish.fail(new Error("network"));await expect(first).rejects.toThrow("network");
 const retry=loader.load("background.png");await Promise.resolve();expect(requests).toBe(2);
 finish.success({path:"local.png",width:1024,height:1536});await retry;
 expect((await loader.load("background.png")).path).toBe("local.png");expect(requests).toBe(2);
 loader.clear();const fresh=loader.load("background.png");await Promise.resolve();expect(requests).toBe(3);
 finish.success({path:"fresh.png",width:1024,height:1536});await fresh;
});
test("poster truncates long team name to one line and preserves full resolution QR", async () => {
 const draws: Array<{value:string;y:number}> = [], images: unknown[][]=[];
 const ctx = new Proxy({font:"",measureText:(value:string)=>({width:Array.from(value).length*32}),fillText:(value:string,_x:number,y:number)=>draws.push({value,y}),drawImage:(...args:unknown[])=>images.push(args),draw:(_reserve:boolean,done:()=>void)=>done()}, {get:(target,key)=>key in target?target[key as keyof typeof target]:()=>undefined});
 let exportOptions: any;
 (globalThis as unknown as {uni:typeof uni}).uni = {getImageInfo:({src,success}:any)=>success({path:src,width:1024,height:1536}),createCanvasContext:()=>ctx,canvasToTempFilePath:(options:any)=>{exportOptions=options;options.success({tempFilePath:"poster.jpg"});}} as unknown as typeof uni;
 const teamName="很长的球队名称".repeat(15);
 const view={year:2026,nickname:"球友",team_name:teamName,participation_points:259,participation_rank:4,is_paid_member:false,avatar_url:""} as HonorShare;
 expect(await composeHonorImage("canvas",null,view,HONOR_BACKGROUNDS[0]!,"poster","actual-code.png",()=>true)).toBe("poster.jpg");
 const teamDraws=draws.filter(item=>item.value.startsWith("很长"));
 expect(teamDraws).toHaveLength(1);
 expect(teamDraws[0]!.value.endsWith("…")).toBe(true);
 expect(Array.from(teamDraws[0]!.value).length*32).toBeLessThanOrEqual(700);
 expect([exportOptions.destWidth,exportOptions.destHeight]).toEqual([1024,1536]);
 expect(images.some(args=>args[0]==="actual-code.png")).toBe(true);
});
