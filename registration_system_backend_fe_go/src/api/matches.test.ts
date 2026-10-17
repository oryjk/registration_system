import { clearAdminToken, setAdminToken } from "../auth/token-storage";
import { uploadMatchCoverImage } from "./matches";

describe("match cover upload api", () => {
  beforeEach(() => {
    setAdminToken("test-admin-token");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    clearAdminToken();
    vi.unstubAllGlobals();
  });

  it("uploads a file through the authenticated admin endpoint with browser multipart headers", async () => {
    const result = { image_url: "https://cdn.example.com/match.webp" };
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ code: 0, data: result }),
    } as Response);
    const file = new File(["webp"], "cover.webp", { type: "image/webp" });

    await expect(uploadMatchCoverImage(file)).resolves.toEqual(result);

    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/go-api/api/v1/admin/matches/cover-images");
    expect(options?.method).toBe("POST");
    const body = options?.body as FormData;
    expect([...body.keys()]).toEqual(["file"]);
    expect(body.get("file")).toBe(file);
    expect(options?.headers).toEqual({
      Authorization: "Bearer test-admin-token",
    });
  });

  it("surfaces backend file validation errors", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 422,
      json: async () => ({ code: 422, message: "封面图片不能超过 2MB" }),
    } as Response);
    await expect(
      uploadMatchCoverImage(new File(["x"], "cover.png")),
    ).rejects.toThrow("封面图片不能超过 2MB");
  });
});
