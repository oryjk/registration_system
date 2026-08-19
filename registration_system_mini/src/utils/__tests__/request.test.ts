import { describe, expect, test } from "bun:test";
import { ApiRequestError, isNetworkUnavailableError, isUnauthorizedError, requestApi } from "../request";

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

function installFailingRequest(errMsg: string, modalCalls: string[] = []) {
  (globalThis as { uni?: unknown }).uni = {
    request(options: { fail: (value: { errMsg: string }) => void }) {
      options.fail({ errMsg });
    },
    showModal(options: { complete?: () => void }) {
      modalCalls.push("shown");
      options.complete?.();
    },
  };
}

describe("App request envelope", () => {
  test("returns data when the response code is zero", async () => {
    installMockRequest({ statusCode: 200, data: { code: 0, message: "ok", data: { id: 37 } } });

    const result = await requestApi<{ id: number }>({ url: "/users/me" });
    expect(result).toEqual({ id: 37 });
  });

  test("preserves the error code and message", async () => {
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

describe("Network unavailable handling", () => {
  test("normalizes connection failure into a clear message and shows the dialog", async () => {
    const modalCalls: string[] = [];
    installFailingRequest("request:fail ", modalCalls);

    let error: unknown;
    try {
      await requestApi({ url: "/users/me" });
    } catch (caught) {
      error = caught;
    }
    expect(isNetworkUnavailableError(error)).toEqual(true);
    expect((error as Error).message).toEqual("网络连接不可用，请检查网络后重试");
    expect(modalCalls).toEqual(["shown"]);
  });

  test("normalizes timeout into a clear message", async () => {
    const modalCalls: string[] = [];
    installFailingRequest("request:fail timeout", modalCalls);

    let error: unknown;
    try {
      await requestApi({ url: "/users/me" });
    } catch (caught) {
      error = caught;
    }
    expect(isNetworkUnavailableError(error)).toEqual(true);
    expect((error as Error).message).toEqual("网络连接超时，请检查网络后重试");
  });

  test("keeps the dialog single while parallel requests fail together", async () => {
    const modalCalls: string[] = [];
    installFailingRequest("request:fail ", modalCalls);

    const failures = await Promise.allSettled([
      requestApi({ url: "/users/me" }),
      requestApi({ url: "/teams/my", auth: true }),
    ]);
    expect(failures.every((result) => result.status === "rejected")).toEqual(true);
    expect(modalCalls).toEqual(["shown"]);
  });
});
