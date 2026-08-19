import { PageContainer } from "@ant-design/pro-components/es/layout/components/PageContainer";
import ProTable, { type ProColumns } from "@ant-design/pro-components/es/table";
import { Alert, Button, Typography } from "antd";
import { useState } from "react";
import { useTipsQuery } from "../hooks/queries/useTipQueries";
import type { TipItem } from "../types/tip";

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatYuan(amountCents: number) {
  return `¥${(amountCents / 100).toFixed(2)}`;
}

export default function TipListPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const tips = useTipsQuery({ page, page_size: pageSize });

  const columns: ProColumns<TipItem>[] = [
    {
      title: "打赏用户",
      dataIndex: "nickname",
      width: 200,
      render: (_, item) => (
        <div className="match-name-cell">
          <strong>{item.nickname || "未设置昵称"}</strong>
          <Typography.Text type="secondary">ID {item.user_id}</Typography.Text>
        </div>
      ),
    },
    {
      title: "金额",
      dataIndex: "amount_cents",
      width: 110,
      render: (_, item) => <strong>{formatYuan(item.amount_cents)}</strong>,
    },
    {
      title: "功能建议",
      dataIndex: "suggestion",
      ellipsis: true,
      render: (_, item) =>
        item.suggestion ? (
          <Typography.Text
            style={{ maxWidth: 420 }}
            ellipsis={{ tooltip: item.suggestion }}
          >
            {item.suggestion}
          </Typography.Text>
        ) : (
          <Typography.Text type="secondary">未留言</Typography.Text>
        ),
    },
    { title: "订单号", dataIndex: "order_no", width: 210 },
    {
      title: "支付时间",
      dataIndex: "submitted_at",
      width: 170,
      renderText: formatDateTime,
    },
  ];

  const error = tips.error instanceof Error ? tips.error.message : "";

  return (
    <PageContainer
      title="打赏与建议"
      content={`共 ${tips.data?.total || 0} 笔已支付打赏；用户"请喝咖啡"时可附功能建议，支付成功后才显示在这里`}
    >
      {error ? (
        <Alert
          className="service-alert"
          type="error"
          showIcon
          message={error}
          action={
            tips.isError ? (
              <Button size="small" onClick={() => void tips.refetch()}>
                重试
              </Button>
            ) : null
          }
        />
      ) : null}

      <ProTable<TipItem>
        rowKey="order_no"
        search={false}
        options={false}
        cardProps={{ className: "match-table-panel" }}
        loading={tips.isFetching}
        dataSource={tips.data?.items || []}
        columns={columns}
        scroll={{ x: 960 }}
        pagination={{
          current: page,
          pageSize,
          total: tips.data?.total || 0,
          showSizeChanger: true,
          showTotal: (value) => `共 ${value} 条`,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPageSize === pageSize ? nextPage : 1);
            setPageSize(nextPageSize);
          },
        }}
      />
    </PageContainer>
  );
}
