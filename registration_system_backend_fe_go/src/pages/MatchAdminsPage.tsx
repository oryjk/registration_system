import { Search, ShieldCheck, ShieldOff } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { ErrorAlert } from "@/components/admin/error-alert";
import { MemberCell } from "@/components/admin/member-cell";
import { PaginationBar } from "@/components/admin/pagination-bar";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useSetMatchAdminMutation,
  useUnsetMatchAdminMutation,
  useWeChatUsersQuery,
} from "@/hooks/queries/useUserQueries";
import { formatCompactDateTime } from "@/utils/format";
import type { WeChatUser, WeChatUserListQuery } from "../types/user";
import {
  parseUserListQuery,
  serializeUserListQuery,
} from "../utils/user-list-query";

export default function MatchAdminsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const query = parseUserListQuery(location.search);
  const users = useWeChatUsersQuery(query);
  const setMatchAdmin = useSetMatchAdminMutation();
  const unsetMatchAdmin = useUnsetMatchAdminMutation();
  const [searchDraft, setSearchDraft] = useState(query.search || "");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    setSearchDraft(query.search || "");
  }, [query.search]);

  const updateQuery = (changes: Partial<WeChatUserListQuery>) => {
    const next = { ...query, ...changes };
    navigate(`/match-admins${serializeUserListQuery(next)}`);
  };

  const toggleMatchAdmin = async (user: WeChatUser) => {
    setActionError("");
    try {
      if (user.is_match_admin) {
        await unsetMatchAdmin.mutateAsync(user.id);
      } else {
        await setMatchAdmin.mutateAsync(user.id);
      }
    } catch (reason) {
      setActionError(
        reason instanceof Error ? reason.message : "更新比赛管理员失败",
      );
    }
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
      key: "is_match_admin",
      title: "比赛管理员",
      width: 110,
      render: (user) =>
        user.is_match_admin ? (
          <StatusBadge label="已授权" variant="info" />
        ) : (
          <span className="cell-secondary">--</span>
        ),
    },
    {
      key: "created_at",
      title: "注册时间",
      width: 150,
      render: (user) => formatCompactDateTime(user.created_at),
    },
    {
      key: "action",
      title: "操作",
      width: 130,
      render: (user) => (
        <Button
          disabled={setMatchAdmin.isPending || unsetMatchAdmin.isPending}
          onClick={() => void toggleMatchAdmin(user)}
          size="sm"
          type="button"
          variant={user.is_match_admin ? "outline" : "default"}
        >
          {user.is_match_admin ? (
            <>
              <ShieldOff size={14} />
              取消授权
            </>
          ) : (
            <>
              <ShieldCheck size={14} />
              设为管理员
            </>
          )}
        </Button>
      ),
    },
  ];

  const queryError = users.error instanceof Error ? users.error.message : "";
  const error = actionError || queryError;

  return (
    <div className="content-grid">
      <Card>
        <CardHeader>
          <CardTitle>比赛管理员</CardTitle>
          <CardDescription>
            {`被授权的微信用户可在小程序端录入比赛比分 · 当前授权 ${
              query.match_admin_only ? users.data?.total || 0 : "--"
            } 人（勾选“只看已授权”查看）`}
          </CardDescription>
          <CardAction>
            <div className="list-toolbar">
              <Input
                aria-label="搜索微信用户"
                className="match-search"
                onChange={(event) => setSearchDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    updateQuery({ page: 1, search: searchDraft.trim() });
                  }
                }}
                placeholder="搜索昵称、姓名、手机号或用户 ID"
                value={searchDraft}
              />
              <Button
                onClick={() =>
                  updateQuery({ page: 1, search: searchDraft.trim() })
                }
                type="button"
                variant="outline"
              >
                <Search size={15} />
                搜索
              </Button>
              <Select
                value={query.match_admin_only ? "admin" : "all"}
                onValueChange={(value) =>
                  updateQuery({ page: 1, match_admin_only: value === "admin" })
                }
              >
                <SelectTrigger className="status-filter" style={{ width: 140 }}>
                  <SelectValue placeholder="全部用户" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部用户</SelectItem>
                  <SelectItem value="admin">只看已授权</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="table-card-content">
          {error ? (
            <ErrorAlert
              message={error}
              onRetry={users.isError ? () => void users.refetch() : undefined}
            />
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
