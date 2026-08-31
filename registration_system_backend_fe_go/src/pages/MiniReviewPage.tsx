import { useState } from "react";
import { ConfirmPopover } from "@/components/admin/confirm-popover";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { ErrorAlert } from "@/components/admin/error-alert";
import { FilterSelect, ListToolbar } from "@/components/admin/list-toolbar";
import { PaginationBar } from "@/components/admin/pagination-bar";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  useMiniReviewStatusesQuery,
  useSetMiniReviewStatusMutation,
} from "@/hooks/queries/useMiniReviewQueries";
import type { MiniReviewStatusItem } from "@/types/miniReview";
import { formatNumericDateTime } from "@/utils/format";

export default function MiniReviewPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [projectCode, setProjectCode] = useState<string>("all");
  const [actionError, setActionError] = useState("");
  const statuses = useMiniReviewStatusesQuery({
    page,
    page_size: pageSize,
    project_code: projectCode === "all" ? undefined : projectCode,
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

  const columns: DataTableColumn<MiniReviewStatusItem>[] = [
    { key: "project_code", title: "项目", width: 220 },
    {
      key: "version",
      title: "版本",
      width: 120,
      render: (item) => <span className="cell-strong">{item.version}</span>,
    },
    {
      key: "is_reviewing",
      title: "审核状态",
      width: 110,
      render: (item) =>
        item.is_reviewing ? (
          <StatusBadge label="审核中" variant="warning" />
        ) : (
          <StatusBadge label="已通过" variant="success" />
        ),
    },
    { key: "status_text", title: "状态文案", width: 140 },
    {
      key: "updated_at",
      title: "更新时间",
      width: 170,
      render: (item) => formatNumericDateTime(item.updated_at),
    },
    {
      key: "created_at",
      title: "登记时间",
      width: 170,
      render: (item) => formatNumericDateTime(item.created_at),
    },
    {
      key: "action",
      title: "操作",
      width: 130,
      render: (item) =>
        item.is_reviewing ? (
          <ConfirmPopover
            confirmText="标记通过"
            description="通过后该版本小程序不再收起创建入口与钱包。"
            onConfirm={() => void updateStatus(item, false)}
            title={`标记 ${item.version} 审核通过`}
          >
            <Button size="sm" type="button" variant="link">
              标记通过
            </Button>
          </ConfirmPopover>
        ) : (
          <ConfirmPopover
            confirmText="重新审核"
            description="审核中时小程序会收起创建入口与钱包。"
            onConfirm={() => void updateStatus(item, true)}
            title={`重新打开 ${item.version} 审核`}
          >
            <Button size="sm" type="button" variant="link">
              重新审核
            </Button>
          </ConfirmPopover>
        ),
    },
  ];

  const queryError =
    statuses.error instanceof Error ? statuses.error.message : "";
  const error = actionError || queryError;

  return (
    <div className="content-grid">
      <Card>
        <CardHeader>
          <CardTitle>审核版本</CardTitle>
          <CardDescription>
            {`共 ${statuses.data?.total || 0} 条版本记录；生产构建自动登记新版本，过审后在此标记通过`}
          </CardDescription>
        </CardHeader>
        <CardContent className="table-card-content">
          <ListToolbar>
            <FilterSelect
              ariaLabel="筛选项目"
              onValueChange={(value) => {
                setProjectCode(value);
                setPage(1);
              }}
              options={[
                { value: "all", label: "全部项目" },
                {
                  value: "registration_system_mini",
                  label: "registration_system_mini",
                },
              ]}
              placeholder="全部项目"
              value={projectCode}
              width="wide"
            />
          </ListToolbar>

          {error ? (
            <ErrorAlert
              message={error}
              onRetry={
                statuses.isError ? () => void statuses.refetch() : undefined
              }
            />
          ) : null}

          <DataTable
            columns={columns}
            emptyText="暂无版本记录"
            items={statuses.data?.items}
            loading={statuses.isFetching}
            rowKey={(item) => String(item.id)}
          />
          <PaginationBar
            onChange={(nextPage, nextPageSize) => {
              setPage(nextPageSize === pageSize ? nextPage : 1);
              setPageSize(nextPageSize);
            }}
            page={page}
            pageSize={pageSize}
            total={statuses.data?.total || 0}
          />
        </CardContent>
      </Card>
    </div>
  );
}
