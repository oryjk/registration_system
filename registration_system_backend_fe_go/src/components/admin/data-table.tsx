import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export interface DataTableColumn<T> {
  key: string;
  title: ReactNode;
  width?: number | string;
  align?: "left" | "right" | "center";
  render?: (item: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  items: T[] | undefined;
  loading: boolean;
  emptyText?: string;
  rowKey: (item: T) => string;
  className?: string;
  /** 固定布局按列配置分配空间，避免首列吞掉所有剩余宽度。 */
  layout?: "auto" | "fixed";
  /** 表格内部滚动，表头持续可见；不改变默认页面滚动行为。 */
  scrollable?: boolean;
}

export function DataTable<T>({
  columns,
  items,
  loading,
  emptyText = "暂无数据",
  rowKey,
  className,
  layout = "auto",
  scrollable = false,
}: DataTableProps<T>) {
  const columnCount = columns.length;
  const rows = items ?? [];

  return (
    <Table
      className={cn(
        "ui-table",
        layout === "fixed" && "data-table-fixed",
        className,
      )}
      containerClassName={scrollable ? "data-table-scroll-region" : undefined}
      data-loading={loading || undefined}
    >
      {layout === "fixed" ? (
        <colgroup>
          {columns.map((column) => (
            <col key={column.key} style={{ width: column.width }} />
          ))}
        </colgroup>
      ) : null}
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead
              key={column.key}
              style={{
                width: column.width,
                textAlign: column.align ?? "left",
              }}
            >
              {column.title}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading && rows.length === 0 ? (
          <TableRow className="loading-row">
            <TableCell colSpan={columnCount}>加载中…</TableCell>
          </TableRow>
        ) : rows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={columnCount}>
              <span className="empty">{emptyText}</span>
            </TableCell>
          </TableRow>
        ) : (
          rows.map((item) => (
            <TableRow key={rowKey(item)}>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  style={{ textAlign: column.align ?? "left" }}
                >
                  {column.render
                    ? column.render(item)
                    : String(
                        (item as Record<string, unknown>)[column.key] ?? "-",
                      )}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
