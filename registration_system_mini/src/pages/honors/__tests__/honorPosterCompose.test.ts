const {expect,test}:any=await import("bun:test");
import pages from "../../../pages.json";
import { composeHonorImage } from "@/utils/honorPosterCompose";
import { HONOR_BACKGROUNDS } from "@/config/honorBackgrounds";
import type { HonorShare } from "@/api/honors";

test("ordinary launch still opens home, where scene codes are routed", () => {
 expect(pages.pages[0]?.path).toBe("pages/home/index");
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
