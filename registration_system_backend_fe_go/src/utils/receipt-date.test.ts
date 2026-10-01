import { formatShanghaiDateInput } from "./format";

describe("receipt date input", () => {
  it("uses Shanghai calendar days at both sides of midnight", () => {
    expect(formatShanghaiDateInput(new Date("2026-10-01T15:30:00Z"))).toBe(
      "2026-10-01",
    );
    expect(formatShanghaiDateInput(new Date("2026-10-01T16:30:00Z"))).toBe(
      "2026-10-02",
    );
  });
});
