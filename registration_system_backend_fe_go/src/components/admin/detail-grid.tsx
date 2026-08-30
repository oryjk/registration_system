import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * 详情网格（antd Descriptions 的语义化替代）：
 * dl/dt/dd 结构 + data-display.css 的 .detail-grid 布局。
 */
export function DetailGrid({
  children,
  className,
  single,
}: {
  children: ReactNode;
  className?: string;
  /** 单列模式（侧栏详情 Sheet 用） */
  single?: boolean;
}) {
  return (
    <dl
      className={cn("detail-grid", single && "detail-grid-single", className)}
    >
      {children}
    </dl>
  );
}

export function DetailItem({
  label,
  children,
  full,
}: {
  label: ReactNode;
  children: ReactNode;
  /** 占满整行（如长文本说明） */
  full?: boolean;
}) {
  return (
    <div className={cn(full && "detail-grid-full")}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
