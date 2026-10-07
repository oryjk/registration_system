import { HONOR_BACKGROUNDS } from "@/config/honorBackgrounds";

const STORAGE_KEY="honor-background-files-v1";
const backgroundUrls=new Set(HONOR_BACKGROUNDS.flatMap(item=>[item.imageUrl,item.thumbnailUrl]));

/** Only public immutable preset assets belong here; never persist avatars or QR codes. */
export function createHonorBackgroundCache() {
 const saved:Record<string,string>={},temporary=new Map<string,string>(),pending=new Map<string,Promise<string>>();
 try {
  const stored=uni.getStorageSync(STORAGE_KEY);
  if(stored && typeof stored==="object")for(const url of backgroundUrls)if(typeof stored[url]==="string")saved[url]=stored[url];
 } catch { /* An unavailable preference store must not block images. */ }
 function persist(){try{uni.setStorageSync(STORAGE_KEY,{...saved});}catch{/* Runtime paths still work. */}}
 async function exists(path:string):Promise<boolean> {
  try {return await new Promise<boolean>((resolve,reject)=>uni.getFileSystemManager().getFileInfo({filePath:path,success:result=>resolve(result.size>0),fail:reject}));}
  catch {return false;}
 }
 async function load(url:string):Promise<string> {
  const cached=saved[url] || temporary.get(url);
  if(cached && await exists(cached))return cached;
  if(saved[url]){delete saved[url];persist();}temporary.delete(url);
  const path=await new Promise<string>((resolve,reject)=>uni.downloadFile({url,
   success:result=>result.statusCode===200 && result.tempFilePath ? resolve(result.tempFilePath) : reject(new Error("背景下载失败")),fail:reject,
  }));
  try {
   const local=await new Promise<string>((resolve,reject)=>uni.getFileSystemManager().saveFile({tempFilePath:path,
    success:result=>result.savedFilePath ? resolve(result.savedFilePath) : reject(new Error("背景缓存失败")),fail:reject,
   }));
   saved[url]=local;persist();return local;
  } catch {temporary.set(url,path);return path;}
 }
 return {
  get(url:string):Promise<string> {
   if(!backgroundUrls.has(url))return Promise.resolve(url);
   const existing=pending.get(url);if(existing)return existing;
   const task=load(url).catch(()=>url).finally(()=>{if(pending.get(url)===task)pending.delete(url);});
   pending.set(url,task);return task;
  },
 };
}
let shared:ReturnType<typeof createHonorBackgroundCache>|undefined;
export function resolveHonorBackgroundImage(url:string):Promise<string> {
 // #ifdef MP-WEIXIN
 if(typeof uni.downloadFile==="function" && typeof uni.getFileSystemManager==="function"){
  shared ??= createHonorBackgroundCache();return shared.get(url);
 }
 // #endif
 // H5 uses the immutable HTTP cache; saveFile is unavailable in browsers.
 return Promise.resolve(url);
}
