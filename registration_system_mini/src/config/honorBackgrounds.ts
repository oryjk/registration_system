export interface HonorBackground {
 id: "pitch" | "gold" | "night";
 name: string;
 imageUrl: string;
 thumbnailUrl: string;
 access: "free";
 source: "preset";
 version: number;
 textColor: string;
 mutedTextColor: string;
}
export const HONOR_BACKGROUNDS: readonly HonorBackground[] = [
 { id:"pitch", name:"绿茵日常", imageUrl:"https://oryjk.cn:82/registration/static/share/honor-backgrounds/v2/pitch/4d8ee2edf056f8d8.jpg", thumbnailUrl:"https://oryjk.cn:82/registration/static/share/honor-backgrounds/v2/pitch/aa0a1ea65ec02442.jpg", access:"free", source:"preset", version:2, textColor:"#00214d", mutedTextColor:"#226342" },
 { id:"gold", name:"荣耀金", imageUrl:"https://oryjk.cn:82/registration/static/share/honor-backgrounds/v2/gold/240965d36ee9791e.jpg", thumbnailUrl:"https://oryjk.cn:82/registration/static/share/honor-backgrounds/v2/gold/647b5d47052ffc29.jpg", access:"free", source:"preset", version:2, textColor:"#00214d", mutedTextColor:"#805414" },
 { id:"night", name:"夜场聚光", imageUrl:"https://oryjk.cn:82/registration/static/share/honor-backgrounds/v2/night/bd507b4eb67f1885.jpg", thumbnailUrl:"https://oryjk.cn:82/registration/static/share/honor-backgrounds/v2/night/fc192a335c4a6587.jpg", access:"free", source:"preset", version:2, textColor:"#fffffe", mutedTextColor:"#bdeee7" },
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
