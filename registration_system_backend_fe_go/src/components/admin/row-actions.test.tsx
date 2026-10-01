import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ConfirmPopover } from "./confirm-popover";
import { RowActionButton } from "./row-actions";

describe("row action trigger composition", () => {
  let container: HTMLDivElement;
  let root: Root;
  beforeAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  });
  afterAll(() => {
    Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: false });
  });
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });
  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it("forwards native attributes, events and the anchor ref to the button", async () => {
    const ref = createRef<HTMLButtonElement>();
    const onKeyDown = vi.fn();
    await act(async () => {
      root.render(
        <RowActionButton
          aria-expanded={false}
          icon={<span>删除</span>}
          label="删除球队"
          onClick={() => {}}
          onKeyDown={onKeyDown}
          ref={ref}
        />,
      );
    });
    const button = container.querySelector("button");
    expect(ref.current).toBe(button);
    expect(button?.getAttribute("aria-expanded")).toBe("false");
    await act(async () => {
      button?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
      );
    });
    expect(onKeyDown).toHaveBeenCalledOnce();
  });

  it("opens the confirmation and confirms only after the confirm button is clicked", async () => {
    const onConfirm = vi.fn();
    await act(async () => {
      root.render(
        <ConfirmPopover
          confirmText="永久删除"
          onConfirm={onConfirm}
          title="删除测试球队？"
        >
          <RowActionButton
            icon={<span>删除</span>}
            label="删除测试球队"
            onClick={() => {}}
          />
        </ConfirmPopover>,
      );
    });
    const trigger = container.querySelector("button");
    await act(async () => trigger?.click());
    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    expect(onConfirm).not.toHaveBeenCalled();
    const confirm = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent === "永久删除",
    );
    expect(confirm).toBeDefined();
    await act(async () => confirm?.click());
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
  });
});
