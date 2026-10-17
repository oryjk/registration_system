import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useForm } from "react-hook-form";
import { useUploadMatchCoverImageMutation } from "@/hooks/queries/useMatchQueries";
import { defaultMatchCoverUrl, MatchCoverSection } from "./match-cover-section";
import type { MatchFormValues } from "./schema";

const originalCover = "https://cdn.example.com/original.webp";
const uploadedCover = "https://cdn.example.com/new.webp";

function Harness({ disabled = false }: { disabled?: boolean }) {
  const form = useForm<MatchFormValues>({
    defaultValues: { cover_image_url: originalCover },
  });
  const uploadImage = useUploadMatchCoverImageMutation();
  return (
    <MatchCoverSection
      disabled={disabled}
      form={form}
      uploadImage={uploadImage}
    />
  );
}

describe("match cover form", () => {
  let root: Root;
  let container: HTMLDivElement;
  let queryClient: QueryClient;

  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });
  afterAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
  });
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    queryClient = new QueryClient({
      defaultOptions: { mutations: { retry: false } },
    });
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    queryClient.clear();
    container.remove();
    vi.unstubAllGlobals();
  });

  async function render(disabled = false) {
    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <Harness disabled={disabled} />
        </QueryClientProvider>,
      );
    });
  }

  async function selectFile(file: File) {
    const input = container.querySelector("input");
    if (!input) throw new Error("cover file input missing");
    Object.defineProperty(input, "files", {
      configurable: true,
      value: [file],
    });
    await act(async () => {
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  }

  it("switches the form to the default cover without an API request", async () => {
    await render();
    const restore = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "恢复默认封面",
    );
    await act(async () => restore?.click());
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      defaultMatchCoverUrl,
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps the existing cover until upload succeeds and disables changes while uploading", async () => {
    let finishUpload: (response: Response) => void = () => {};
    vi.mocked(fetch).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishUpload = resolve;
        }),
    );
    await render();
    await selectFile(new File(["webp"], "new.webp", { type: "image/webp" }));
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      originalCover,
    );
    expect(container.querySelector("input")?.disabled).toBe(true);
    expect(
      Array.from(container.querySelectorAll("button")).every(
        (button) => button.disabled,
      ),
    ).toBe(true);
    await act(async () => {
      finishUpload({
        ok: true,
        status: 200,
        json: async () => ({ code: 0, data: { image_url: uploadedCover } }),
      } as Response);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      uploadedCover,
    );
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("retains the previous cover and shows upload errors", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("上传服务不可用"));
    await render();
    await selectFile(new File(["png"], "new.png", { type: "image/png" }));
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      originalCover,
    );
    expect(container.textContent).toContain("上传服务不可用");
  });

  it.each([
    new File(["gif"], "cover.gif", { type: "image/gif" }),
    new File([new Uint8Array(2 * 1024 * 1024 + 1)], "cover.png", {
      type: "image/png",
    }),
  ])("rejects invalid files before uploading", async (file) => {
    await render();
    await selectFile(file);
    expect(fetch).not.toHaveBeenCalled();
    expect(container.textContent).toContain("文件不超过 2MB");
    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      originalCover,
    );
  });

  it("disables uploads and reset while the match is saving", async () => {
    await render(true);
    expect(container.querySelector("input")?.disabled).toBe(true);
    expect(
      Array.from(container.querySelectorAll("button")).every(
        (button) => button.disabled,
      ),
    ).toBe(true);
  });
});
