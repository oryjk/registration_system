import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** 表格操作列容器，配合 RowActionButton 使用。 */
export function RowActions({ children }: { children: ReactNode }) {
  return <div className="table-row-actions">{children}</div>;
}

/**
 * 操作列图标按钮。
 * 给 tip 时渲染 Tooltip 包裹；省略 tip 时只渲染按钮——
 * 危险操作通常已被 ConfirmPopover 包住，不需要再叠一层提示。
 * 透传原生属性与 ref，供 Radix asChild 绑定触发事件、无障碍属性和定位锚点。
 */
export function RowActionButton({
  className,
  destructive,
  icon,
  label,
  tip,
  ...buttonProps
}: ComponentProps<"button"> & {
  destructive?: boolean;
  icon: ReactNode;
  label: string;
  tip?: string;
}) {
  const button = (
    <Button
      {...buttonProps}
      aria-label={label}
      className={cn(
        "size-control-sm min-h-control-sm",
        destructive && "text-destructive",
        className,
      )}
      size="icon"
      type="button"
      variant="ghost"
    >
      {icon}
    </Button>
  );

  if (!tip) return button;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );
}
