import type { HonorShare } from "@/api/honors";
import type { HonorBackground } from "@/config/honorBackgrounds";
import { formatHonorPoints, honorTitle } from "@/pages/honors/honorState";
import { beijingDateKey } from "@/utils/datetime";
import { resolveMinioImage, retainMinioImage } from "@/utils/minioImageCache";

type ImageInfo = { path: string; width: number; height: number };
const imageInfo = (src: string): Promise<ImageInfo> => new Promise((resolve,reject) => uni.getImageInfo({src,success:resolve,fail:reject}));
/** Page-scoped local image paths; coalesce downloads and retry failed requests. */
export function createHonorImageLoader() {
 const images=new Map<string,Promise<ImageInfo>>();
 const releases=new Map<string,()=>void>();
 function drop(src:string){releases.get(src)?.();releases.delete(src);images.delete(src);}
 return {
  load(src:string):Promise<ImageInfo> {
   const cached=images.get(src);if(cached)return cached;
   const task=resolveMinioImage(src).then(imageInfo).catch(failure=>{if(images.get(src)===task)drop(src);throw failure;});
   // The three presets plus avatars/codes fit comfortably; bound changing data too.
   if(images.size>=16)drop(images.keys().next().value!);
   releases.set(src,retainMinioImage(src));
   images.set(src,task);return task;
  },
  clear(){for(const src of images.keys())drop(src);},
 };
}
function text(ctx: UniApp.CanvasContext,value: string,x: number,y: number,size: number,color: string,align: "left" | "center" = "center",weight = 400) {
 ctx.setFillStyle(color);ctx.setTextAlign(align);ctx.setTextBaseline("middle");ctx.font=`${weight} ${size}px sans-serif`;ctx.fillText(value,x,y);
}
function nameLines(ctx: UniApp.CanvasContext,value: string,maxWidth: number,maxLines = 2): string[] {
 const lines:string[]=[];const chars=Array.from(value.trim() || "球友");
 let offset=0;
 while(offset<chars.length && lines.length<maxLines) {
  let line="";
  while(offset<chars.length && ctx.measureText(line+chars[offset]).width<=maxWidth)line+=chars[offset++]!;
  if(!line)line=chars[offset++]!;
  if(lines.length===maxLines-1 && offset<chars.length) {
   while(line && ctx.measureText(line+"…").width>maxWidth)line=Array.from(line).slice(0,-1).join("");
   line+="…";
  }
  lines.push(line);
 }
 return lines;
}
function roundRect(ctx: UniApp.CanvasContext,x: number,y: number,width: number,height: number,radius: number) {
 ctx.beginPath();ctx.moveTo(x+radius,y);ctx.lineTo(x+width-radius,y);ctx.quadraticCurveTo(x+width,y,x+width,y+radius);
 ctx.lineTo(x+width,y+height-radius);ctx.quadraticCurveTo(x+width,y+height,x+width-radius,y+height);
 ctx.lineTo(x+radius,y+height);ctx.quadraticCurveTo(x,y+height,x,y+height-radius);
 ctx.lineTo(x,y+radius);ctx.quadraticCurveTo(x,y,x+radius,y);ctx.closePath();
}
function portrait(ctx: UniApp.CanvasContext,avatar: ImageInfo | null,view: HonorShare,x: number,y: number,size: number) {
 ctx.save();roundRect(ctx,x,y,size,size,32);ctx.clip();ctx.setFillStyle("#e8f5ee");ctx.fillRect(x,y,size,size);
 if(avatar) {
  const side=Math.min(avatar.width,avatar.height);
  ctx.drawImage(avatar.path,(avatar.width-side)/2,(avatar.height-side)/2,side,side,x,y,size,size);
 } else text(ctx,Array.from(view.nickname || "球友")[0]!,x+size/2,y+size/2,size*0.45,"#226342");
 ctx.restore();ctx.setStrokeStyle(view.is_paid_member ? "#d1ad5c" : "#ffffff");ctx.setLineWidth(6);
 roundRect(ctx,x-3,y-3,size+6,size+6,35);ctx.stroke();
}
/** Use uni canvas API on both targets; export full resolution, not a screenshot of UI. */
export async function composeHonorImage(
 canvasId: string,pageInstance: unknown,view: HonorShare,background: HonorBackground,
 kind: "poster" | "card",miniCodeUrl: string | null,isCurrent: () => boolean,
 loadImage: (src:string)=>Promise<ImageInfo> = imageInfo,
): Promise<string> {
 if(!isCurrent())throw new Error("海报内容已更新");
 if(kind==="poster" && !miniCodeUrl)throw new Error("小程序码还未生成");
 const [backdrop,avatar,crown,code]=await Promise.all([
  loadImage(background.imageUrl),
  view.avatar_url ? loadImage(view.avatar_url).catch(()=>null) : null,
  view.is_paid_member ? loadImage("/static/icons/lucide/member-crown.png") : null,
  kind==="poster" && miniCodeUrl ? loadImage(miniCodeUrl) : null,
 ]);
 if(!isCurrent())throw new Error("海报内容已更新");
 const width=kind==="poster"?1024:1000,height=kind==="poster"?1536:800;
 const ctx=uni.createCanvasContext(canvasId,pageInstance as never);
 const ratio=Math.max(width/backdrop.width,height/backdrop.height);
 ctx.drawImage(backdrop.path,(width-backdrop.width*ratio)/2,(height-backdrop.height*ratio)/2,backdrop.width*ratio,backdrop.height*ratio);
 const fg=background.textColor,muted=background.mutedTextColor;
 if(kind==="poster") {
  text(ctx,`${view.year} · 我的足球年度`,512,225,34,muted);
  portrait(ctx,avatar,view,422,315,180);if(crown)ctx.drawImage(crown.path,477,258,70,70);
  ctx.font="600 54px sans-serif";nameLines(ctx,view.nickname,700).forEach((line,index)=>text(ctx,line,512,546+index*62,54,fg,"center",600));
  ctx.font="400 32px sans-serif";nameLines(ctx,view.team_name,700,1).forEach(line=>text(ctx,line,512,665,32,muted));
  text(ctx,"年度参与星",512,721,36,muted);
  text(ctx,formatHonorPoints(view.participation_points)+" 星",512,835,152,fg,"center",600);
  const honor=honorTitle(view.participation_points,view.participation_rank);
  if(honor)text(ctx,honor,512,957,36,muted,"center",600);
  text(ctx,"每一次参与，都值得记录",512,honor?1012:969,34,fg);
  // White is intrinsic QR quiet-zone, independent of user's app theme.
  ctx.setFillStyle("#ffffff");roundRect(ctx,143,1080,738,260,30);ctx.fill();
  if(code)ctx.drawImage(code.path,163,1100,220,220);
  text(ctx,"扫码看我的荣誉",425,1150,40,"#00214d","left",600);
  text(ctx,"加入球队 · 创建自己的球队",425,1215,28,"#1b2d45","left");
  text(ctx,`记录于 ${beijingDateKey(Date.now())}`,425,1270,24,"#526174","left");
 } else {
  text(ctx,`${view.year} · 我的足球年度`,500,120,32,muted);
  portrait(ctx,avatar,view,116,232,172);if(crown)ctx.drawImage(crown.path,168,180,65,65);
  ctx.font="600 54px sans-serif";nameLines(ctx,view.nickname,550).forEach((line,index)=>text(ctx,line,350,256+index*64,54,fg,"left",600));
  ctx.font="400 30px sans-serif";nameLines(ctx,view.team_name,550,1).forEach(line=>text(ctx,line,350,405,30,muted,"left"));
  text(ctx,formatHonorPoints(view.participation_points)+" 星",500,556,126,fg,"center",600);
  text(ctx,honorTitle(view.participation_points,view.participation_rank) || "每一次参与，都值得记录",500,671,36,muted);
 }
 return new Promise((resolve,reject)=>{
  ctx.draw(false,()=>{
   if(!isCurrent()){reject(new Error("海报内容已更新"));return;}
   uni.canvasToTempFilePath({canvasId,x:0,y:0,width,height,destWidth:width,destHeight:height,fileType:"jpg",quality:0.92,
    success:result=>isCurrent()?resolve(result.tempFilePath):reject(new Error("海报内容已更新")),fail:reject,
   },pageInstance as never);
  });
 });
}
