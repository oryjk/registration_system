import { expireAdminSession } from "./session-expiry";
import { clearAdminToken, getAdminToken, setAdminToken } from "./token-storage";

describe("expireAdminSession", () => {
  beforeEach(() => {
    clearAdminToken();
  });

  it("clears the token and dispatches the expiry event once", () => {
    const listener = jest.fn();
    window.addEventListener("admin-auth-expired", listener);
    setAdminToken("test-token");

    expireAdminSession();
    expireAdminSession();

    expect(getAdminToken()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener("admin-auth-expired", listener);
  });
});
