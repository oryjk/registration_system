import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SortHeaderProps {
  label: ReactNode;
  /** 当前列的排序方向；null 表示该列未参与排序。 */
  direction: "asc" | "desc" | null;
  onToggle: () => void;
  ariaLabel: string;
}

/** 列头排序切换：激活列显示方向箭头，未激活列显示中性图标，点击切换方向。 */
export function SortHeader({
  label,
  direction,
  onToggle,
  ariaLabel,
}: SortHeaderProps) {
  const Icon =
    direction === "asc"
      ? ArrowUp
      : direction === "desc"
        ? ArrowDown
        : ChevronsUpDown;

  return (
    <button
      aria-label={
        direction
          ? `${ariaLabel}（当前${direction === "asc" ? "升序" : "降序"}）`
          : ariaLabel
      }
      className={cn(
        "inline-flex cursor-pointer items-center gap-1 text-inherit hover:text-foreground",
        direction && "text-foreground",
      )}
      onClick={onToggle}
      type="button"
    >
      {label}
      <Icon
        aria-hidden="true"
        className={cn("size-3.5 shrink-0", !direction && "opacity-50")}
      />
    </button>
  );
}
