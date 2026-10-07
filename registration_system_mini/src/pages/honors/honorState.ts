import type { AvatarItem } from "@/components/ui/avatarTypes";
import type { HonorBackground } from "@/config/honorBackgrounds";
export type HonorSource = { code: string } | { teamId: number };
export function resolveHonorSource(options: Record<string, unknown>): HonorSource | null {
 const raw = options.code ?? options.scene;
 if (raw !== undefined) {
  try { const code=decodeURIComponent(String(raw)); return /^[A-Za-z0-9_-]{22}$/.test(code) ? {code} : null; } catch { return null; }
 }
 const teamId=Number(options.teamId);
 return Number.isSafeInteger(teamId) && teamId>0 ? {teamId} : null;
}
export function ownHonorAvatarTeam(avatar: AvatarItem | null, userId?: number): number | null {
 if (!userId || !avatar || String(avatar.id)!==String(userId)) return null;
 const id=avatar.teamId;return typeof id==="number" && Number.isSafeInteger(id) && id>0 ? id : null;
}
export function honorTitle(points: number, rank: number): string {
 return Number.isFinite(points) && points>0 ? ({1:"年度活跃冠军",2:"年度活跃亚军",3:"年度活跃季军"} as Record<number,string>)[rank] ?? "" : "";
}
export function formatHonorPoints(points: number): string {
 return Number.isFinite(points) && points>=0 ? String(Math.round(points*10)/10) : "0";
}
export function honorSharePath(code: string,background?:HonorBackground["id"]): string {
 return `/pages/honors/index?code=${encodeURIComponent(code)}${background ? `&background=${encodeURIComponent(background)}` : ""}`;
}
