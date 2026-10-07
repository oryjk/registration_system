export interface HonorBackground {
 id: "pitch" | "gold" | "night";
 name: string;
 imageUrl: string;
 access: "free";
 source: "preset";
 version: number;
 textColor: string;
 mutedTextColor: string;
}
export const HONOR_BACKGROUNDS: readonly HonorBackground[] = [
 { id:"pitch", name:"绿茵日常", imageUrl:"https://oryjk.cn:82/registration/static/share/honor-backgrounds/v1/pitch/2d51f31cb46c3eea.png", access:"free", source:"preset", version:1, textColor:"#00214d", mutedTextColor:"#226342" },
 { id:"gold", name:"荣耀金", imageUrl:"https://oryjk.cn:82/registration/static/share/honor-backgrounds/v1/gold/cc0c4a2aa7859e52.png", access:"free", source:"preset", version:1, textColor:"#00214d", mutedTextColor:"#805414" },
 { id:"night", name:"夜场聚光", imageUrl:"https://oryjk.cn:82/registration/static/share/honor-backgrounds/v1/night/5014b02961d35122.png", access:"free", source:"preset", version:1, textColor:"#fffffe", mutedTextColor:"#bdeee7" },
];
const STORAGE_KEY = "honor-poster-background-v1";
export function resolveHonorBackground(id: unknown): HonorBackground {
 return HONOR_BACKGROUNDS.find(item => item.id === id) ?? HONOR_BACKGROUNDS[0]!;
}
export function readHonorBackground(): HonorBackground {
 try { return resolveHonorBackground(uni.getStorageSync(STORAGE_KEY)); } catch { return resolveHonorBackground(""); }
}
export function rememberHonorBackground(id: HonorBackground["id"]) {
 try { uni.setStorageSync(STORAGE_KEY,id); } catch { /* Preference failure does not block sharing. */ }
}
