import { ref,watch,type Ref } from "vue";
import { HONOR_BACKGROUNDS,type HonorBackground } from "@/config/honorBackgrounds";
import { resolveHonorBackgroundImage } from "@/utils/honorBackgroundCache";

export function useHonorBackgroundImages(background:Ref<HonorBackground>,isSelf:Ref<boolean>,ready:Ref<boolean>) {
 const backgroundImageUrl=ref("");
 const backgroundThumbnailUrls=ref<Record<string,string>>({});
 watch([background,ready],([bg,visible],_previous,onCleanup)=>{
  let current=true;onCleanup(()=>{current=false;});backgroundImageUrl.value="";
  if(!visible)return;
  void resolveHonorBackgroundImage(bg.imageUrl).then(path=>{if(current)backgroundImageUrl.value=path;});
 },{immediate:true});
 watch([isSelf,ready],([self,visible],_previous,onCleanup)=>{
  if(!self || !visible)return;
  let current=true;onCleanup(()=>{current=false;});
  backgroundThumbnailUrls.value={};
  for(const bg of HONOR_BACKGROUNDS) {
   void resolveHonorBackgroundImage(bg.thumbnailUrl).then(path=>{
    if(current)backgroundThumbnailUrls.value={...backgroundThumbnailUrls.value,[bg.id]:path};
   });
  }
 },{immediate:true});
 return {backgroundImageUrl,backgroundThumbnailUrls};
}
