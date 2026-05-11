import { describe, expect, test } from "bun:test";
import { isMockWxPaymentParams, normalizeWxPaymentParams } from "../payment";

describe("normalizeWxPaymentParams", () => {
  test("normalizes snake_case payment payloads from backend", () => {
    const params = normalizeWxPaymentParams({
      time_stamp: "1713333333",
      nonce_str: "nonce-123",
      package: "prepay_id=wx123",
      sign_type: "MD5",
      pay_sign: "signed",
    });

    expect(params).toEqual({
      timeStamp: "1713333333",
      nonceStr: "nonce-123",
      package: "prepay_id=wx123",
      signType: "MD5",
      paySign: "signed",
    });
  });

  test("returns null when any required payment field is missing", () => {
    expect(
      normalizeWxPaymentParams({
        time_stamp: "1713333333",
        nonce_str: "nonce-123",
        package: "prepay_id=wx123",
        sign_type: "MD5",
      }),
    ).toEqual(null);
  });
});

describe("isMockWxPaymentParams", () => {
  test("detects mock pay sign for local testing flow", () => {
    expect(
      isMockWxPaymentParams({
        timeStamp: "1713333333",
        nonceStr: "nonce-123",
        package: "prepay_id=wx123",
        signType: "MD5",
        paySign: "mock_sign_for_testing",
      }),
    ).toEqual(true);
  });
});
