describe("admin server sessions", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    vi.stubEnv("ADMIN_API_BASE_URL", "/registration-admin-api/ip");
    vi.stubEnv(
      "ADMIN_API_ALTERNATE_BASE_URL",
      "/registration-admin-api/domain",
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    localStorage.clear();
  });

  it("restores the selected server without sharing its token with the other server", async () => {
    const { getApiBaseUrl, setAdminServer } = await import("../config/api");
    const { getAdminToken, setAdminToken } = await import("./token-storage");

    localStorage.setItem("registration-admin-go.token.v1", "legacy-token");
    expect(getAdminToken()).toBeNull();
    setAdminToken("ip-token");

    setAdminServer("alternate");
    expect(getApiBaseUrl()).toBe("/registration-admin-api/domain");
    expect(getAdminToken()).toBeNull();
    setAdminToken("domain-token");

    vi.resetModules();
    const restoredApi = await import("../config/api");
    const restoredToken = await import("./token-storage");
    expect(restoredApi.getApiBaseUrl()).toBe("/registration-admin-api/domain");
    expect(restoredToken.getAdminToken()).toBe("domain-token");

    restoredApi.setAdminServer("default");
    expect(restoredApi.getApiBaseUrl()).toBe("/registration-admin-api/ip");
    expect(restoredToken.getAdminToken()).toBe("ip-token");
  });
});
