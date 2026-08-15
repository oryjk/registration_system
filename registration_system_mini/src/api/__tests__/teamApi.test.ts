import { describe, expect, test } from "bun:test";
import { miniPath } from "@/test/sourcePaths";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

async function read(path: string) {
  return Bun.file(miniPath(path)).text();
}

describe("team member profile mapping", () => {
  test("keeps nickname and avatar when mapping app members to the backend shape", async () => {
    const api = await read("src/api/team.ts");
    const types = await read("src/types/backend.ts");

    // 队员管理页的头像/昵称依赖接口返回的用户资料，映射层不能丢弃。
    expect(api.includes("nickname: member.nickname,")).toEqual(true);
    expect(api.includes("avatar_url: member.avatar_url,")).toEqual(true);
    expect(api.includes("real_name: member.real_name,")).toEqual(true);
    expect(types.includes("nickname?: string;")).toEqual(true);
    expect(types.includes("avatar_url?: string | null;")).toEqual(true);
  });

  test("falls back to the member-carried profile when usersById misses the user", async () => {
    const attendance = await read("src/pages/teams/manage/useTeamAttendance.ts");

    // usersById 只含搜索/添加流程碰过的用户；队员列表自带资料必须兜底展示。
    expect(attendance.includes("function memberProfile(userId: number): BackendTeamMember | undefined")).toEqual(true);
    expect(attendance.includes("memberProfile(userId)?.nickname?.trim()")).toEqual(true);
    expect(attendance.includes("memberProfile(userId)?.avatar_url?.trim()")).toEqual(true);
  });

  test("mock member list mirrors the app member shape", async () => {
    const handlers = await read("src/mock/handlers.ts");
    const membersHandler = handlers.slice(
      handlers.indexOf('pattern: "/teams/:id/members"'),
      handlers.indexOf('pattern: "/teams/:id/password-info"'),
    );

    expect(membersHandler.includes("nickname:")).toEqual(true);
    expect(membersHandler.includes("avatar_url:")).toEqual(true);
  });
});
