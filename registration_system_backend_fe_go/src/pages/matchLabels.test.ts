import {
  getPublicationModeLabel,
  publicationModeDescriptions,
} from "./matchLabels";

describe("match publication mode labels", () => {
  it("maps all supported modes and provides a read-only fallback", () => {
    expect(getPublicationModeLabel("offline_confirmed")).toBe("线下已约");
    expect(getPublicationModeLabel("online_team")).toBe("线上约队");
    expect(getPublicationModeLabel("online_individual")).toBe("散人对手");
    expect(getPublicationModeLabel("future_mode")).toBe("其他类型");
  });

  it("describes the different recruitment behavior", () => {
    expect(publicationModeDescriptions).toEqual({
      offline_confirmed: "已线下确定对手，无需线上招募",
      online_team: "在线招募一支球队作为对手",
      online_individual: "在线招募个人组成对手阵容",
    });
  });
});
