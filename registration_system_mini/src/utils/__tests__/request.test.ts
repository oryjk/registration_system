import { describe, expect, test } from "bun:test";
import { ApiRequestError, isUnauthorizedError, requestApi } from "../request";

type MockRequestResponse = {
  statusCode: number;
  data: unknown;
};

function installMockRequest(response: MockRequestResponse) {
  (globalThis as { uni?: unknown }).uni = {
    request(options: { success: (value: MockRequestResponse) => void }) {
      options.success(response);
    },
  };
}

describe("Go app request envelope", () => {
  test("returns data when the Go response code is zero", async () => {
    installMockRequest({ statusCode: 200, data: { code: 0, message: "ok", data: { id: 37 } } });

    const result = await requestApi<{ id: number }>({ url: "/users/me" });
    expect(result).toEqual({ id: 37 });
  });

  test("preserves the Go error code and message", async () => {
    installMockRequest({ statusCode: 200, data: { code: 422, message: "用户资料无效", data: null } });

    let error: unknown;
    try {
      await requestApi({ url: "/users/me", method: "PATCH", data: {} });
    } catch (caught) {
      error = caught;
    }
    expect(error instanceof ApiRequestError).toEqual(true);
    expect((error as ApiRequestError).statusCode).toEqual(422);
    expect((error as Error).message).toEqual("用户资料无效");
  });

  test("only treats HTTP 401 as an expired session", () => {
    expect(isUnauthorizedError(new ApiRequestError("unauthorized", 401))).toEqual(true);
    expect(isUnauthorizedError(new ApiRequestError("forbidden", 403))).toEqual(false);
  });
});
