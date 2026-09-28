import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { ErrorAlert } from "@/components/admin/error-alert";
import { FilterSelect, ListToolbar } from "@/components/admin/list-toolbar";
import { MemberCell } from "@/components/admin/member-cell";
import { PaginationBar } from "@/components/admin/pagination-bar";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useWeChatUsersQuery } from "@/hooks/queries/useUserQueries";
import {
  formatCompactDateTime,
  formatDateTime,
  formatRelativeDateTime,
} from "@/utils/format";
import type {
  WeChatUser,
  WeChatUserActivity,
  WeChatUserListQuery,
} from "../types/user";
import {
  parseUserListQuery,
  serializeUserListQuery,
} from "../utils/user-list-query";

const DAY_MS = 24 * 60 * 60 * 1000;

function activityStatus(lastActiveAt: string | null) {
  if (!lastActiveAt) {
    return { label: "从未记录", variant: "secondary" };
  }
  const timestamp = new Date(lastActiveAt).getTime();
  if (Number.isNaN(timestamp)) {
    return { label: "时间异常", variant: "warning" };
  }
  const elapsed = Math.max(0, Date.now() - timestamp);
  if (elapsed <= 7 * DAY_MS) {
    return { label: "7 日内活跃", variant: "success" };
  }
  if (elapsed <= 30 * DAY_MS) {
    return { label: "30 日内活跃", variant: "info" };
  }
  return { label: "30 天未活跃", variant: "warning" };
}

export default function UserListPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const parsedQuery = parseUserListQuery(location.search);
  const query: WeChatUserListQuery = {
    ...parsedQuery,
    match_admin_only: false,
  };
  const users = useWeChatUsersQuery(query);
  const [searchDraft, setSearchDraft] = useState(query.search || "");

  useEffect(() => {
    setSearchDraft(query.search || "");
  }, [query.search]);

  const updateQuery = (changes: Partial<WeChatUserListQuery>) => {
    const next = { ...query, ...changes, match_admin_only: false };
    navigate(`/users${serializeUserListQuery(next)}`);
  };

  const columns: DataTableColumn<WeChatUser>[] = [
    {
      key: "nickname",
      title: "用户",
      render: (user) => (
        <MemberCell
          avatarUrl={user.avatar_url}
          name={user.nickname || `用户 ${user.id}`}
          secondary={user.real_name || undefined}
          tertiary={`用户 ID ${user.id}`}
        />
      ),
    },
    {
      key: "phone_number",
      title: "手机号",
      width: 140,
      render: (user) => user.phone_number || "--",
    },
    {
      key: "identity",
      title: "身份",
      width: 110,
      render: (user) =>
        user.is_match_admin ? (
          <StatusBadge label="比赛管理员" variant="info" />
        ) : (
          <StatusBadge label="普通用户" variant="secondary" />
        ),
    },
    {
      key: "status",
      title: "账号状态",
      width: 100,
      render: (user) =>
        user.status === "active" ? (
          <StatusBadge label="正常" variant="success" />
        ) : (
          <StatusBadge label="已冻结" variant="destructive" />
        ),
    },
    {
      key: "last_active_at",
      title: "最近活跃",
      width: 170,
      render: (user) => {
        const status = activityStatus(user.last_active_at);
        return (
          <div className="activity-cell">
            <StatusBadge label={status.label} variant={status.variant} />
            {user.last_active_at ? (
              <time
                dateTime={user.last_active_at}
                title={formatDateTime(user.last_active_at)}
              >
                {formatRelativeDateTime(user.last_active_at)}
                <span>{formatCompactDateTime(user.last_active_at)}</span>
              </time>
            ) : (
              <span className="cell-secondary">暂无活跃记录</span>
            )}
          </div>
        );
      },
    },
    {
      key: "created_at",
      title: "注册时间",
      width: 150,
      render: (user) => formatCompactDateTime(user.created_at),
    },
  ];

  const error = users.error instanceof Error ? users.error.message : "";

  return (
    <div className="content-grid">
      <Card>
        <CardHeader>
          <CardTitle>用户管理</CardTitle>
          <CardDescription>
            查看小程序用户与最近使用状态 · 活跃时间最多每 30 分钟更新一次 ·
            当前筛选 {users.data?.total ?? "--"} 人
          </CardDescription>
          <CardAction>
            <ListToolbar
              search={{
                ariaLabel: "搜索微信用户",
                onValueChange: setSearchDraft,
                onSubmit: () =>
                  updateQuery({ page: 1, search: searchDraft.trim() }),
                placeholder: "搜索昵称、姓名、手机号或用户 ID",
                value: searchDraft,
              }}
            >
              <FilterSelect
                ariaLabel="筛选用户活跃状态"
                onValueChange={(value) =>
                  updateQuery({
                    page: 1,
                    activity: value as WeChatUserActivity,
                  })
                }
                options={[
                  { value: "all", label: "全部活跃状态" },
                  { value: "active_7d", label: "近 7 天活跃" },
                  { value: "inactive_30d", label: "30 天未活跃" },
                  { value: "never", label: "从未记录" },
                ]}
                placeholder="全部活跃状态"
                value={query.activity || "all"}
                width="wide"
              />
            </ListToolbar>
          </CardAction>
        </CardHeader>
        <CardContent className="table-card-content">
          {error ? (
            <ErrorAlert message={error} onRetry={() => void users.refetch()} />
          ) : null}
          <DataTable
            columns={columns}
            emptyText="没有找到匹配的微信用户"
            items={users.data?.items || []}
            loading={users.isLoading}
            rowKey={(user) => String(user.id)}
          />
          <PaginationBar
            onChange={(page, pageSize) =>
              updateQuery({ page, page_size: pageSize })
            }
            page={users.data?.page || 1}
            pageSize={users.data?.page_size || 20}
            total={users.data?.total || 0}
          />
        </CardContent>
      </Card>
    </div>
  );
}
