import { describe, expect, test } from "bun:test";
import { formatDetailFee, resolveDetailActions, isDetailRegistrationReadOnly } from "../detailPresentation";

describe("match detail action composition", () => {
  for (const hasRoster of [false, true]) {
    for (const pickup of [false, true]) {
      test(`closed registration keeps payment only: roster=${hasRoster}, pickup=${pickup}`, () => {
        expect(resolveDetailActions({ closed: true, pendingPayment: true, hasRoster, pickup, paid: false }))
          .toEqual({ primary: "pay", secondary: null });
      });
      test(`pending payment preserves the right secondary action: roster=${hasRoster}, pickup=${pickup}`, () => {
        expect(resolveDetailActions({ closed: false, pendingPayment: true, hasRoster, pickup, paid: false }))
          .toEqual({ primary: "pay", secondary: pickup || !hasRoster ? "individual" : "roster" });
      });
    }
  }
  test("paid pickup cannot use roster to bypass the existing edit lock", () => {
    expect(resolveDetailActions({ closed: false, pendingPayment: false, hasRoster: true, pickup: true, paid: true }))
      .toEqual({ primary: null, secondary: null });
  });
  test("closed unpaid registration has no action", () => {
    expect(resolveDetailActions({ closed: true, pendingPayment: false, hasRoster: true, pickup: false, paid: false }))
      .toEqual({ primary: null, secondary: null });
  });
  test("fees distinguish missing, free, and payment timing without multiplying by attendees", () => {
    expect(formatDetailFee(null)).toEqual("费用待确认");
    expect(formatDetailFee({ fee_per_person_cents: 0 })).toEqual("免费");
    expect(formatDetailFee({ fee_per_person_cents: 2500, payment_mode: "prepaid" })).toEqual("¥25.00/人 · 赛前支付");
    expect(formatDetailFee({ fee_per_person_cents: 2500, payment_mode: "postpaid" })).toEqual("¥25.00/人 · 赛后结算");
  });
});

test("started matches are read-only even before the server advances status", () => {
  const match = { status: "registering" as const, start_time: "2026-09-22T12:00:00Z" };
  expect(isDetailRegistrationReadOnly(match, false, Date.parse("2026-09-22T11:59:00Z"))).toEqual(false);
  expect(isDetailRegistrationReadOnly(match, false, Date.parse(match.start_time))).toEqual(true);
  expect(isDetailRegistrationReadOnly(match, true, 0)).toEqual(true);
});
