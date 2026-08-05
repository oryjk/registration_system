import {
  clearAdminToken,
  getAdminToken,
  setAdminToken,
} from "../auth/token-storage";
import { request } from "./client";

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

function invalidJsonResponse(status: number) {
  return {
    ok: false,
    status,
    json: async () => {
      throw new SyntaxError("Unexpected token '<'");
    },
  } as unknown as Response;
}

describe("request auth modes", () => {
  beforeEach(() => {
    clearAdminToken();
    process.env.ADMIN_API_BASE_URL = "/go-api";
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("expires an existing session when a required request returns 401", async () => {
    const listener = jest.fn();
    window.addEventListener("admin-auth-expired", listener);
    setAdminToken("existing-token");
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse(401, { code: 40101, message: "登录已过期", data: null }),
      );

    await expect(request("/auth/me")).rejects.toEqual(
      expect.objectContaining({ status: 401, code: 40101 }),
    );

    expect(fetch).toHaveBeenCalledWith(
      "/go-api/api/admin/auth/me",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer existing-token",
        }),
      }),
    );
    expect(getAdminToken()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("admin-auth-expired", listener);
  });

  it("treats a login 401 as a normal error without expiring another session", async () => {
    const listener = jest.fn();
    window.addEventListener("admin-auth-expired", listener);
    setAdminToken("existing-token");
    jest.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(401, {
        code: 40102,
        message: "账号或密码错误",
        data: null,
      }),
    );

    await expect(
      request("/auth/login", { auth: "login", method: "POST" }),
    ).rejects.toEqual(expect.objectContaining({ status: 401, code: 40102 }));

    const [, options] = jest.mocked(fetch).mock.calls[0];
    expect(fetch).toHaveBeenCalledWith(
      "/go-api/api/admin/auth/login",
      expect.any(Object),
    );
    expect(options?.headers).not.toEqual(
      expect.objectContaining({ Authorization: expect.any(String) }),
    );
    expect(getAdminToken()).toBe("existing-token");
    expect(listener).not.toHaveBeenCalled();
    window.removeEventListener("admin-auth-expired", listener);
  });

  it("keeps health requests outside the admin API and omits authorization", async () => {
    jest
      .mocked(fetch)
      .mockResolvedValueOnce(
        jsonResponse(200, { code: 0, message: "ok", data: { status: "ok" } }),
      );

    await expect(request("/health", { auth: "none" })).resolves.toEqual({
      status: "ok",
    });

    const [, options] = jest.mocked(fetch).mock.calls[0];
    expect(fetch).toHaveBeenCalledWith("/go-api/health", expect.any(Object));
    expect(options?.headers).not.toEqual(
      expect.objectContaining({ Authorization: expect.any(String) }),
    );
  });

  it("expires a required session before parsing a non-JSON 401 response", async () => {
    const listener = jest.fn();
    window.addEventListener("admin-auth-expired", listener);
    setAdminToken("expired-token");
    jest.mocked(fetch).mockResolvedValueOnce(invalidJsonResponse(401));

    await expect(request("/matches")).rejects.toEqual(
      expect.objectContaining({ status: 401 }),
    );

    expect(getAdminToken()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("admin-auth-expired", listener);
  });

  it.each([
    ["login", "/auth/login"],
    ["none", "/health"],
  ] as const)(
    "preserves the session for a non-JSON %s 401 response",
    async (auth, path) => {
      const listener = jest.fn();
      window.addEventListener("admin-auth-expired", listener);
      setAdminToken("existing-token");
      jest.mocked(fetch).mockResolvedValueOnce(invalidJsonResponse(401));

      await expect(request(path, { auth })).rejects.toEqual(
        expect.objectContaining({ status: 401 }),
      );

      expect(getAdminToken()).toBe("existing-token");
      expect(listener).not.toHaveBeenCalled();
      window.removeEventListener("admin-auth-expired", listener);
    },
  );
});
