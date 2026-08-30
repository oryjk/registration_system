import { Eye, Plus, Search, Square, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { ConfirmPopover } from "@/components/admin/confirm-popover";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { ErrorAlert } from "@/components/admin/error-alert";
import { NameCell } from "@/components/admin/member-cell";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAdminSession } from "@/features/admin-session/useAdminSession";
import {
  useDeleteMatchMutation,
  useMatchesQuery,
  useUpdateMatchStatusMutation,
} from "@/hooks/queries/useMatchQueries";
import { formatCompactDateTime } from "@/utils/format";
import type { MatchItem, MatchListQuery } from "../types/match";
import {
  parseMatchListQuery,
  serializeMatchListQuery,
} from "../utils/match-list-query";
import {
  getPublicationModeLabel,
  matchStatusColors,
  matchStatusLabels,
} from "./matchLabels";

export default function MatchListPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const query = parseMatchListQuery(location.search);
  const matches = useMatchesQuery(query);
  const updateStatus = useUpdateMatchStatusMutation();
  const deleteMatch = useDeleteMatchMutation();
  const { currentAdmin } = useAdminSession();
  const isSuperAdmin = Boolean(currentAdmin?.is_super_admin);
  const [searchDraft, setSearchDraft] = useState(query.search || "");
  const [actionKey, setActionKey] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    setSearchDraft(query.search || "");
  }, [query.search]);

  const updateQuery = (changes: Partial<MatchListQuery>) => {
    const next = { ...query, ...changes };
    navigate(`/matches${serializeMatchListQuery(next)}`);
  };

  const cancelMatch = async (item: MatchItem) => {
    const key = `cancel:${item.id}`;
    setActionKey(key);
    setActionError("");
    try {
      await updateStatus.mutateAsync({ id: item.id, status: "cancelled" });
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "取消比赛失败");
    } finally {
      setActionKey("");
    }
  };

  const removeMatch = async (item: MatchItem) => {
    const key = `delete:${item.id}`;
    setActionKey(key);
    setActionError("");
    try {
      await deleteMatch.mutateAsync(item.id);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "删除比赛失败");
    } finally {
      setActionKey("");
    }
  };

  const columns: DataTableColumn<MatchItem>[] = [
    {
      key: "name",
      title: "比赛",
      render: (item) => (
        <NameCell
          subtitle={getPublicationModeLabel(item.publication_mode)}
          title={item.name}
        />
      ),
    },
    { key: "host_team_name", title: "主队", width: 160 },
    {
      key: "location",
      title: "场地",
      width: 180,
      render: (item) => <span>{item.location}</span>,
    },
    {
      key: "start_time",
      title: "开赛时间",
      width: 150,
      render: (item) => formatCompactDateTime(item.start_time),
    },
    {
      key: "status",
      title: "状态",
      width: 100,
      render: (item) => (
        <StatusBadge
          label={matchStatusLabels[item.status]}
          variant={matchStatusColors[item.status]}
        />
      ),
    },
    {
      key: "action",
      title: "操作",
      width: isSuperAdmin ? 150 : 104,
      render: (item) => (
        <div className="table-row-actions">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={`查看${item.name}`}
                onClick={() => navigate(`/matches/${item.id}`)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Eye size={15} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>查看比赛</TooltipContent>
          </Tooltip>
          {item.status === "registering" || item.status === "ongoing" ? (
            <ConfirmPopover
              confirmText="确认取消"
              description="比赛取消后不可恢复。"
              onConfirm={() => void cancelMatch(item)}
              title={`取消“${item.name}”`}
            >
              <Button
                aria-label={`取消${item.name}`}
                disabled={actionKey === `cancel:${item.id}`}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Square size={15} />
              </Button>
            </ConfirmPopover>
          ) : null}
          {isSuperAdmin ? (
            <ConfirmPopover
              confirmText="永久删除"
              destructive
              description="比赛及其报名、申请数据将永久删除。"
              onConfirm={() => void removeMatch(item)}
              title={`永久删除“${item.name}”`}
            >
              <Button
                aria-label={`删除${item.name}`}
                className="text-destructive"
                disabled={actionKey === `delete:${item.id}`}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Trash2 size={15} />
              </Button>
            </ConfirmPopover>
          ) : null}
        </div>
      ),
    },
  ];

  const queryError =
    matches.error instanceof Error ? matches.error.message : "";
  const error = actionError || queryError;

  return (
    <div className="content-grid">
      <Card>
        <CardHeader>
          <CardTitle>比赛管理</CardTitle>
          <CardDescription>{`共 ${matches.data?.total || 0} 场比赛`}</CardDescription>
          <CardAction>
            <Button onClick={() => navigate("/matches/new")} type="button">
              <Plus size={15} />
              发布比赛
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="table-card-content">
          <div className="list-toolbar">
            <Input
              aria-label="搜索比赛"
              className="match-search"
              onChange={(event) => setSearchDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  updateQuery({ page: 1, search: searchDraft.trim() });
                }
              }}
              placeholder="搜索比赛、场地或主队"
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
              value={query.status || "all"}
              onValueChange={(value) =>
                updateQuery({
                  page: 1,
                  status:
                    value === "all"
                      ? undefined
                      : (value as MatchListQuery["status"]),
                })
              }
            >
              <SelectTrigger className="status-filter" style={{ width: 140 }}>
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {Object.entries(matchStatusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error ? (
            <ErrorAlert
              message={error}
              onRetry={
                matches.isError ? () => void matches.refetch() : undefined
              }
            />
          ) : null}

          <DataTable
            columns={columns}
            emptyText="暂无比赛"
            items={matches.data?.items}
            loading={matches.isFetching}
            rowKey={(item) => String(item.id)}
          />
          <PaginationBar
            onChange={(page, pageSize) =>
              updateQuery({
                page: pageSize === query.page_size ? page : 1,
                page_size: pageSize,
              })
            }
            page={query.page}
            pageSize={query.page_size}
            total={matches.data?.total || 0}
          />
        </CardContent>
      </Card>
    </div>
  );
}
