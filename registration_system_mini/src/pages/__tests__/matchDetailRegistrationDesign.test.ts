import { describe, expect, test } from "bun:test";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

describe("match detail registration design", () => {
  test("uses an in-page segmented layout for individual and team registration", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/detail.vue",
    ).text();

    expect(source.includes("const registrationMode = ref<\"individual\" | \"team\">(\"individual\");")).toEqual(true);
    expect(source.includes("散客报名")).toEqual(true);
    expect(source.includes("球队报名")).toEqual(true);
    expect(source.includes("registration-segment")).toEqual(true);
    expect(source.includes("registrationMode === 'individual'")).toEqual(true);
    expect(source.includes("registrationMode === 'team'")).toEqual(true);
  });

  test("renders the individual registration view with countdown, guide card, interest cards, and a primary CTA", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/detail.vue",
    ).text();

    expect(source.includes("报名截止")).toEqual(true);
    expect(source.includes("你可能感兴趣")).toEqual(true);
    expect(source.includes("比赛说明")).toEqual(true);
    expect(source.includes("individual-cta-button")).toEqual(true);
    expect(source.includes("interestCards")).toEqual(true);
  });

  test("renders the team registration view with versus header, grouped roster blocks, and a team submit bar", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/detail.vue",
    ).text();

    expect(source.includes("team-vs-card")).toEqual(true);
    expect(source.includes("已报名")).toEqual(true);
    expect(source.includes("请假")).toEqual(true);
    expect(source.includes("待定")).toEqual(true);
    expect(source.includes("team-status-groups")).toEqual(true);
    expect(source.includes("提交球队报名")).toEqual(true);
  });

  test("submits team registration and check-in through real activity api wrappers", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/detail.vue",
    ).text();

    expect(source.includes("submitTeamRegistration")).toEqual(true);
    expect(source.includes("submitActivityCheckIn")).toEqual(true);
    expect(source.includes("ensureCurrentLocation")).toEqual(true);
    expect(source.includes("队长代报名接口待接入")).toEqual(false);
  });

  test("lets team managers select roster members before submitting team registration", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/detail.vue",
    ).text();

    expect(source.includes("selectedTeamRegistrationIds")).toEqual(true);
    expect(source.includes("toggleTeamMemberRegistration")).toEqual(true);
    expect(source.includes("@tap=\"toggleTeamMemberRegistration(member.id)\"")).toEqual(true);
  });

  test("lets individual users cancel an existing registration from the primary CTA", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/detail.vue",
    ).text();

    expect(source.includes('currentStatus.value === "参加" ? "取消报名" : "立即报名"')).toEqual(true);
    expect(source.includes("handleCancelIndividualSignup")).toEqual(true);
    expect(source.includes("registration_count: 0")).toEqual(true);
    expect(source.includes('title: "已取消报名"')).toEqual(true);
    expect(source.includes("你已经报过名了")).toEqual(false);
  });

  test("confirms individual signup and cancellation before submitting", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/detail.vue",
    ).text();

    expect(source.includes("function confirmRegistrationAction")).toEqual(true);
    expect(source.includes('title: "确认报名"')).toEqual(true);
    expect(source.includes('title: "确认取消报名"')).toEqual(true);
    expect(source.includes("const confirmed = await confirmRegistrationAction")).toEqual(true);
    expect(source.includes("if (!confirmed) return;")).toEqual(true);
  });

  test("updates individual registration locally instead of reloading the whole page", async () => {
    const source = await Bun.file(
      "/Users/carlwang/registration_system/registration_system_mini/src/pages/matches/detail.vue",
    ).text();

    expect(source.includes("function applyIndividualRegistrationState")).toEqual(true);
    expect(source.includes("applyIndividualRegistrationState(1, 1)")).toEqual(true);
    expect(source.includes("applyIndividualRegistrationState(0, 0)")).toEqual(true);
    expect(source.includes("currentStatus.value = toStandLabel(stand);")).toEqual(true);
  });
});
