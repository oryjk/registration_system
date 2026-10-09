const {expect,test,beforeEach}:any=await import("bun:test");
import { HONOR_BACKGROUNDS } from "@/config/honorBackgrounds";
import { createHonorBackgroundCache } from "../honorBackgroundCache";
import { createHonorImageLoader } from "../honorPosterCompose";

let storage:Record<string,string>,files:Set<string>,downloads:number,saves:number,saveFails:boolean,downloadFails:boolean;
const url=HONOR_BACKGROUNDS[0]!.imageUrl;
beforeEach(()=>{
 storage={};files=new Set();downloads=saves=0;saveFails=downloadFails=false;
 (globalThis as unknown as {uni:typeof uni}).uni={
  getStorageSync:()=>({...storage}),setStorageSync:(_key:string,value:Record<string,string>)=>{storage={...value};},
  getFileSystemManager:()=>({
   getFileInfo:({filePath,success,fail}:any)=>files.has(filePath)?success({size:123}):fail(new Error("missing")),
   saveFile:({tempFilePath,success,fail}:any)=>{saves++;if(saveFails){fail(new Error("quota"));return;}const path="saved-"+tempFilePath;files.delete(tempFilePath);files.add(path);success({savedFilePath:path});},
  }),
  downloadFile:({success,fail}:any)=>{downloads++;if(downloadFails){fail(new Error("network"));return;}const path="tmp-"+downloads;files.add(path);success({statusCode:200,tempFilePath:path});},
 } as unknown as typeof uni;
});
test("coalesces downloads and reuses persistent files after a new page/runtime cache",async()=>{
 const cache=createHonorBackgroundCache();
 const paths=await Promise.all([cache.get(url),cache.get(url)]);
 expect(paths).toEqual(["saved-tmp-1","saved-tmp-1"]);expect(downloads).toBe(1);expect(saves).toBe(1);
 expect(await createHonorBackgroundCache().get(url)).toBe("saved-tmp-1");expect(downloads).toBe(1);
});
test("redownloads when the saved file was removed",async()=>{
 const cache=createHonorBackgroundCache();await cache.get(url);files.clear();
 expect(await cache.get(url)).toBe("saved-tmp-2");expect(downloads).toBe(2);
});
test("cache quota failure keeps the usable temporary file",async()=>{
 saveFails=true;const cache=createHonorBackgroundCache();
 expect(await cache.get(url)).toBe("tmp-1");expect(storage).toEqual({version:1,files:{}});
 expect(await cache.get(url)).toBe("tmp-1");expect(downloads).toBe(1);
});
test("failed downloads fall back to the remote image and can retry",async()=>{
 downloadFails=true;const cache=createHonorBackgroundCache();expect(await cache.get(url)).toBe(url);
 downloadFails=false;expect(await cache.get(url)).toBe("saved-tmp-2");expect(downloads).toBe(2);
});
test("only immutable catalog backgrounds are cached, not arbitrary URLs or avatars",async()=>{
 const foreign="https://example.com/avatar.png";
 expect(await createHonorBackgroundCache().get(foreign)).toBe(foreign);expect(downloads).toBe(0);
});
test("a non-success HTTP response is never saved as an image",async()=>{
 (uni as any).downloadFile=({success}:any)=>success({statusCode:404,tempFilePath:"error.html"});
 expect(await createHonorBackgroundCache().get(url)).toBe(url);expect(saves).toBe(0);expect(storage).toEqual({});
});
test("canvas image loaders reuse the same persisted file across page instances",async()=>{
 const path=await createHonorBackgroundCache().get(url),reads:string[]=[];
 (uni as any).getImageInfo=({src,success}:any)=>{reads.push(src);success({path:src,width:1024,height:1536});};
 await createHonorImageLoader().load(url);await createHonorImageLoader().load(url);
 expect(reads).toEqual([path,path]);expect(downloads).toBe(1);expect(saves).toBe(1);
});
