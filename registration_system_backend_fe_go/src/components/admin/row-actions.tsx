import type { ReactNode } from "react";
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
 */
export function RowActionButton({
  className,
  destructive,
  disabled,
  icon,
  label,
  onClick,
  tip,
}: {
  className?: string;
  destructive?: boolean;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  tip?: string;
}) {
  const button = (
    <Button
      aria-label={label}
      className={cn(destructive && "text-destructive", className)}
      disabled={disabled}
      onClick={onClick}
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
