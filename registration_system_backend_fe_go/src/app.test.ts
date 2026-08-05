import { getCurrentAdmin } from "./api/auth";
import { ApiError } from "./api/client";
import { getInitialState } from "./app";
import {
  clearAdminToken,
  getAdminToken,
  setAdminToken,
} from "./auth/token-storage";

jest.mock("./api/auth", () => ({
  getCurrentAdmin: jest.fn(),
}));

const admin = {
  id: 1,
  username: "root",
  role: "super_admin" as const,
  status: "active" as const,
  is_super_admin: true,
  created_at: "2026-08-04T00:00:00Z",
};

describe("getInitialState", () => {
  beforeEach(() => {
    clearAdminToken();
    jest.mocked(getCurrentAdmin).mockReset();
  });

  it("restores the current administrator when the token is valid", async () => {
    setAdminToken("valid-token");
    jest.mocked(getCurrentAdmin).mockResolvedValueOnce(admin);

    await expect(getInitialState()).resolves.toEqual(
      expect.objectContaining({
        currentAdmin: admin,
        authBootstrapError: null,
        fetchCurrentAdmin: expect.any(Function),
      }),
    );
  });

  it("clears an invalid token after an authentication 401", async () => {
    setAdminToken("expired-token");
    jest
      .mocked(getCurrentAdmin)
      .mockRejectedValueOnce(new ApiError("登录已过期", 401, 40101));

    await expect(getInitialState()).resolves.toEqual(
      expect.objectContaining({
        currentAdmin: null,
        authBootstrapError: null,
      }),
    );
    expect(getAdminToken()).toBeNull();
  });

  it("preserves the token and exposes a retryable error after a server failure", async () => {
    setAdminToken("valid-token");
    jest
      .mocked(getCurrentAdmin)
      .mockRejectedValueOnce(new ApiError("服务暂时不可用", 503));

    await expect(getInitialState()).resolves.toEqual(
      expect.objectContaining({
        currentAdmin: null,
        authBootstrapError: "服务暂时不可用",
      }),
    );
    expect(getAdminToken()).toBe("valid-token");
  });
});
