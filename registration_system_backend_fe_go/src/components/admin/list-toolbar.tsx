import { Search } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * 列表筛选下拉。宽度走 spacing 刻度（w-35 = 140px、w-55 = 220px），
 * 不再内联裸像素；刻度锚定 --space-1，改密度时跟随全局收敛。
 */
export function FilterSelect({
  ariaLabel,
  className,
  onValueChange,
  options,
  placeholder,
  value,
  width = "default",
}: {
  ariaLabel: string;
  className?: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  placeholder: string;
  value: string;
  width?: "default" | "wide";
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn(
          "status-filter",
          width === "wide" ? "w-55" : "w-35",
          className,
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * 列表工具条：搜索框 + 可选筛选下拉。
 * search.onSubmit 给出时渲染搜索按钮并支持回车提交（服务端分页场景）；
 * 省略时搜索框为输入即筛选（客户端筛选场景）。
 */
export function ListToolbar({
  children,
  search,
}: {
  children?: ReactNode;
  search?: {
    ariaLabel: string;
    onValueChange: (value: string) => void;
    onSubmit?: () => void;
    placeholder: string;
    value: string;
  };
}) {
  return (
    <div className="list-toolbar">
      {search ? (
        <>
          <Input
            aria-label={search.ariaLabel}
            className="match-search"
            onChange={(event) => search.onValueChange(event.target.value)}
            onKeyDown={
              search.onSubmit
                ? (event) => {
                    if (event.key === "Enter") search.onSubmit?.();
                  }
                : undefined
            }
            placeholder={search.placeholder}
            value={search.value}
          />
          {search.onSubmit ? (
            <Button onClick={search.onSubmit} type="button" variant="outline">
              <Search size={15} />
              搜索
            </Button>
          ) : null}
        </>
      ) : null}
      {children}
    </div>
  );
}
