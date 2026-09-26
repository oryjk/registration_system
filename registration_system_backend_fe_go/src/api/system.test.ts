import { clearAdminToken, setAdminToken } from "../auth/token-storage";
import { request } from "./client";
import {
  clearOnboardingImage,
  clearShareImage,
  getMiniAppSettings,
  uploadNextMatchSocialImage,
  uploadOnboardingImage,
  uploadShareImage,
} from "./system";

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe("mini app settings api", () => {
  beforeEach(() => {
    clearAdminToken();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches mini app settings over the admin api", async () => {
    setAdminToken("token");
    const settings = {
      debug: {
        clear_profile_enabled: false,
        review_status_toggle_enabled: false,
      },
      onboarding: { enabled: false },
      home: { next_match_social_image_url: "" },
    };
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(200, { code: 0, message: "ok", data: settings }),
    );

    await expect(getMiniAppSettings()).resolves.toEqual(settings);

    expect(fetch).toHaveBeenCalledWith(
      "/go-api/api/v1/admin/system/mini-app-settings",
      expect.any(Object),
    );
  });

  it("uploads the next match social image as multipart form data without a json content type", async () => {
    setAdminToken("token");
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(200, {
        code: 0,
        message: "ok",
        data: {
          debug: {
            clear_profile_enabled: false,
            review_status_toggle_enabled: false,
          },
          onboarding: { enabled: false },
          home: {
            next_match_social_image_url: "https://cdn.example.com/a.png",
          },
        },
      }),
    );

    const file = new File(["png-bytes"], "social.png", { type: "image/png" });
    const saved = await uploadNextMatchSocialImage(file);

    expect(saved.home.next_match_social_image_url).toEqual(
      "https://cdn.example.com/a.png",
    );
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toEqual(
      "/go-api/api/v1/admin/system/mini-app-settings/home/next-match-social-image",
    );
    expect(options?.method).toEqual("POST");
    expect(options?.body).toBeInstanceOf(FormData);
    const body = options?.body;
    expect(body && body instanceof FormData ? body.get("file") : null).toBe(
      file,
    );
    expect(options?.headers).not.toEqual(
      expect.objectContaining({ "Content-Type": expect.any(String) }),
    );
    expect(options?.headers).toEqual(
      expect.objectContaining({ Authorization: "Bearer token" }),
    );
  });

  it.each(["welcome", "team", "match"] as const)(
    "uploads only the %s scene without sending other settings",
    async (scene) => {
      const saved = {
        home: {
          next_match_social_image_url: "existing.png",
          onboarding_team_image_url: "team.png",
        },
      };
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse(200, { code: 0, data: saved }),
      );
      const file = new File(["png"], "guide.png", { type: "image/png" });
      await expect(uploadOnboardingImage(scene, file)).resolves.toEqual(saved);
      const [url, options] = vi.mocked(fetch).mock.calls[0];
      expect(url).toBe(
        `/go-api/api/v1/admin/system/mini-app-settings/home/onboarding-images/${scene}`,
      );
      expect(options?.method).toBe("POST");
      const body = options?.body as FormData;
      expect([...body.keys()]).toEqual(["file"]);
      expect(body.get("file")).toBe(file);
    },
  );

  it.each(["welcome", "team", "match"] as const)(
    "clears only the %s scene without overwriting other fields",
    async (scene) => {
      vi.mocked(fetch).mockResolvedValueOnce(
        jsonResponse(200, { code: 0, data: {} }),
      );
      await clearOnboardingImage(scene);
      const [url, options] = vi.mocked(fetch).mock.calls[0];
      expect(url).toBe("/go-api/api/v1/admin/system/mini-app-settings");
      expect(options?.method).toBe("PUT");
      expect(JSON.parse(options?.body as string)).toEqual({
        home: { [`onboarding_${scene}_image_url`]: "" },
      });
    },
  );

  it.each(["home", "hall", "team", "match"] as const)(
    "uploads and clears the %s share scene independently",
    async (scene) => {
      vi.mocked(fetch).mockResolvedValue(
        jsonResponse(200, { code: 0, data: {} }),
      );
      const file = new File(["png"], "cover.png", { type: "image/png" });
      await uploadShareImage(scene, file);
      const [url, options] = vi.mocked(fetch).mock.calls[0];
      expect(url).toBe(
        `/go-api/api/v1/admin/system/mini-app-settings/home/share-images/${scene}`,
      );
      expect(options?.method).toBe("POST");
      const body = options?.body as FormData;
      expect(body.get("file")).toBe(file);
      await clearShareImage(scene);
      const [, clearOptions] = vi.mocked(fetch).mock.calls[1];
      expect(clearOptions?.method).toBe("PUT");
      expect(JSON.parse(clearOptions?.body as string)).toEqual({
        home: { [`share_${scene}_image_url`]: "" },
      });
    },
  );

  it("surfaces the backend validation message for rejected uploads", async () => {
    setAdminToken("token");
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(422, {
        code: 422,
        message: "插画仅支持 PNG、JPG、WebP 格式",
        data: null,
      }),
    );

    const file = new File(["x"], "social.gif", { type: "image/gif" });
    await expect(uploadNextMatchSocialImage(file)).rejects.toEqual(
      expect.objectContaining({
        status: 422,
        message: "插画仅支持 PNG、JPG、WebP 格式",
      }),
    );
  });
});

describe("request content type handling", () => {
  beforeEach(() => {
    clearAdminToken();
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps the default json content type for regular bodies", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(200, { code: 0, message: "ok", data: null }),
    );
    await request("/system/mini-app-settings", {
      method: "PUT",
      body: JSON.stringify({ onboarding: { enabled: true } }),
    });

    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(options?.headers).toEqual(
      expect.objectContaining({ "Content-Type": "application/json" }),
    );
  });

  it("omits the content type for FormData bodies so the browser sets the boundary", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(200, { code: 0, message: "ok", data: null }),
    );
    const formData = new FormData();
    formData.append("file", new File(["x"], "a.png", { type: "image/png" }));
    await request("/system/mini-app-settings/home/next-match-social-image", {
      method: "POST",
      body: formData,
    });

    const [, options] = vi.mocked(fetch).mock.calls[0];
    expect(options?.headers).not.toEqual(
      expect.objectContaining({ "Content-Type": expect.any(String) }),
    );
  });
});
