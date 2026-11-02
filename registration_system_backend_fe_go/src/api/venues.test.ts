import { clearAdminToken, setAdminToken } from "../auth/token-storage";
import { listVenues, setVenueImage, uploadVenueImage } from "./venues";

describe("venue api", () => {
  beforeEach(() => {
    setAdminToken("test-admin-token");
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    clearAdminToken();
    vi.unstubAllGlobals();
  });

  function mockResponse(data: unknown) {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ code: 0, data }),
    } as Response);
  }

  it("lists venues", async () => {
    mockResponse([]);
    await expect(listVenues()).resolves.toEqual([]);
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(
      "/go-api/api/v1/admin/venues",
    );
  });

  it("uploads a venue image as multipart form data", async () => {
    mockResponse({ image_url: "https://cdn.example.com/venue.webp" });
    const file = new File(["webp"], "venue.webp", { type: "image/webp" });
    await uploadVenueImage(file);
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/go-api/api/v1/admin/venues/images");
    expect(options?.method).toBe("POST");
    expect((options?.body as FormData | undefined)?.get("file")).toBe(file);
    expect(options?.headers).toEqual({
      Authorization: "Bearer test-admin-token",
    });
  });

  it("saves and clears the image for a named venue", async () => {
    mockResponse({ location: "体育公园", image_url: "" });
    await setVenueImage("体育公园", "");
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(url).toBe("/go-api/api/v1/admin/venues/image");
    expect(options?.method).toBe("PUT");
    expect(options?.body).toBe(
      JSON.stringify({ location: "体育公园", image_url: "" }),
    );
  });
});
