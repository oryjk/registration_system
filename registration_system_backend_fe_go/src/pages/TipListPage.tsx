import { useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { ErrorAlert } from "@/components/admin/error-alert";
import { NameCell } from "@/components/admin/member-cell";
import { PaginationBar } from "@/components/admin/pagination-bar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTipsQuery } from "@/hooks/queries/useTipQueries";
import type { TipItem } from "@/types/tip";
import { formatNumericDateTime, formatYuan } from "@/utils/format";

export default function TipListPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const tips = useTipsQuery({ page, page_size: pageSize });

  const columns: DataTableColumn<TipItem>[] = [
    {
      key: "nickname",
      title: "打赏用户",
      width: 200,
      render: (item) => (
        <NameCell
          subtitle={`ID ${item.user_id}`}
          title={item.nickname || "未设置昵称"}
        />
      ),
    },
    {
      key: "amount_cents",
      title: "金额",
      width: 110,
      render: (item) => (
        <span className="cell-strong">{formatYuan(item.amount_cents)}</span>
      ),
    },
    {
      key: "suggestion",
      title: "功能建议",
      render: (item) =>
        item.suggestion ? (
          <span className="cell-ellipsis" title={item.suggestion}>
            {item.suggestion}
          </span>
        ) : (
          <span className="cell-secondary">未留言</span>
        ),
    },
    { key: "order_no", title: "订单号", width: 210 },
    {
      key: "submitted_at",
      title: "支付时间",
      width: 170,
      render: (item) => formatNumericDateTime(item.submitted_at),
    },
  ];

  const error = tips.error instanceof Error ? tips.error.message : "";

  return (
    <div className="content-grid">
      <Card>
        <CardHeader>
          <CardTitle>打赏与建议</CardTitle>
          <CardDescription>
            {`共 ${tips.data?.total || 0} 笔已支付打赏；用户"请喝咖啡"时可附功能建议，支付成功后才显示在这里`}
          </CardDescription>
        </CardHeader>
        <CardContent className="table-card-content">
          {error ? (
            <ErrorAlert
              message={error}
              onRetry={tips.isError ? () => void tips.refetch() : undefined}
            />
          ) : null}
          <DataTable
            columns={columns}
            emptyText="暂无打赏记录"
            items={tips.data?.items}
            loading={tips.isFetching}
            rowKey={(item) => item.order_no}
          />
          <PaginationBar
            onChange={(nextPage, nextPageSize) => {
              setPage(nextPageSize === pageSize ? nextPage : 1);
              setPageSize(nextPageSize);
            }}
            page={page}
            pageSize={pageSize}
            total={tips.data?.total || 0}
          />
        </CardContent>
      </Card>
    </div>
  );
}
