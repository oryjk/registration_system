import { PageContainer } from "@ant-design/pro-components/es/layout/components/PageContainer";
import ProTable, { type ProColumns } from "@ant-design/pro-components/es/table";
import { Alert, Button, Popconfirm, Select, Space, Tag } from "antd";
import { useState } from "react";
import {
  useMiniReviewStatusesQuery,
  useSetMiniReviewStatusMutation,
} from "../hooks/queries/useMiniReviewQueries";
import type { MiniReviewStatusItem } from "../types/miniReview";

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

export default function MiniReviewPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [projectCode, setProjectCode] = useState<string | undefined>(undefined);
  const [actionError, setActionError] = useState("");
  const statuses = useMiniReviewStatusesQuery({
    page,
    page_size: pageSize,
    project_code: projectCode,
  });
  const setStatus = useSetMiniReviewStatusMutation();

  const updateStatus = async (
    item: MiniReviewStatusItem,
    isReviewing: boolean,
  ) => {
    setActionError("");
    try {
      await setStatus.mutateAsync({
        id: item.id,
        payload: {
          is_reviewing: isReviewing,
          status_text: isReviewing ? "正在审核" : "审核通过",
        },
      });
    } catch (reason) {
      setActionError(
        reason instanceof Error ? reason.message : "更新审核状态失败",
      );
    }
  };

  const columns: ProColumns<MiniReviewStatusItem>[] = [
    { title: "项目", dataIndex: "project_code", width: 220 },
    {
      title: "版本",
      dataIndex: "version",
      width: 120,
      render: (_, item) => (
        <div className="match-name-cell">
          <strong>{item.version}</strong>
        </div>
      ),
    },
    {
      title: "审核状态",
      dataIndex: "is_reviewing",
      width: 110,
      render: (_, item) =>
        item.is_reviewing ? (
          <Tag color="orange">审核中</Tag>
        ) : (
          <Tag color="green">已通过</Tag>
        ),
    },
    { title: "状态文案", dataIndex: "status_text", width: 140 },
    {
      title: "更新时间",
      dataIndex: "updated_at",
      width: 170,
      renderText: formatDateTime,
    },
    {
      title: "登记时间",
      dataIndex: "created_at",
      width: 170,
      renderText: formatDateTime,
    },
    {
      title: "操作",
      key: "action",
      valueType: "option",
      width: 130,
      fixed: "right",
      render: (_, item) => (
        <Space size={4}>
          {item.is_reviewing ? (
            <Popconfirm
              title={`标记 ${item.version} 审核通过`}
              description="通过后该版本小程序不再收起创建入口与钱包。"
              okText="标记通过"
              cancelText="返回"
              onConfirm={() => updateStatus(item, false)}
            >
              <Button type="link" size="small">
                标记通过
              </Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              title={`重新打开 ${item.version} 审核`}
              description="审核中时小程序会收起创建入口与钱包。"
              okText="重新审核"
              cancelText="返回"
              onConfirm={() => updateStatus(item, true)}
            >
              <Button type="link" size="small">
                重新审核
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const queryError =
    statuses.error instanceof Error ? statuses.error.message : "";
  const error = actionError || queryError;

  return (
    <PageContainer
      title="审核版本"
      content={`共 ${statuses.data?.total || 0} 条版本记录；生产构建自动登记新版本，过审后在此标记通过`}
    >
      <div className="list-toolbar">
        <Select
          allowClear
          placeholder="全部项目"
          className="status-filter"
          value={projectCode}
          options={[
            {
              value: "registration_system_mini",
              label: "registration_system_mini",
            },
          ]}
          onChange={(value) => {
            setProjectCode(value);
            setPage(1);
          }}
        />
      </div>

      {error ? (
        <Alert
          className="service-alert"
          type="error"
          showIcon
          message={error}
          action={
            statuses.isError ? (
              <Button size="small" onClick={() => void statuses.refetch()}>
                重试
              </Button>
            ) : null
          }
        />
      ) : null}

      <ProTable<MiniReviewStatusItem>
        rowKey="id"
        search={false}
        options={false}
        cardProps={{ className: "match-table-panel" }}
        loading={statuses.isFetching}
        dataSource={statuses.data?.items || []}
        columns={columns}
        scroll={{ x: 960 }}
        pagination={{
          current: page,
          pageSize,
          total: statuses.data?.total || 0,
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
