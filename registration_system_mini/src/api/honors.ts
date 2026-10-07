import { requestApi } from "@/utils/request";
export interface HonorShare {
 code: string;
 team_id: number;
 user_id: number;
 year: number;
 team_name: string;
 team_description: string | null;
 team_logo_url: string | null;
 nickname: string;
 avatar_url: string | null;
 participation_points: number;
 participation_rank: number;
 is_paid_member: boolean;
 requires_password: boolean;
 is_member: boolean;
}
export function issueHonorShare(teamId: number) {
 return requestApi<HonorShare>({ url: `/teams/${teamId}/honor-share`, method: "POST", auth: true });
}
export function resolveHonorShare(code: string) {
 return requestApi<HonorShare>({ url: `/honor-shares/${encodeURIComponent(code)}`, auth: true });
}
export function getHonorMiniCode(code: string, environment: "release" | "trial" | "develop") {
 return requestApi<{ image_url: string }>({ url: `/honor-shares/${encodeURIComponent(code)}/mini-code`, method: "POST", data: { environment }, auth: true });
}
