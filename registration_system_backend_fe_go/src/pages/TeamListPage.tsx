import { Eye, KeyRound, Pencil, Plus, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmPopover } from "@/components/admin/confirm-popover";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { DetailGrid, DetailItem } from "@/components/admin/detail-grid";
import { ErrorAlert } from "@/components/admin/error-alert";
import { MemberCell, NameCell } from "@/components/admin/member-cell";
import { StatusBadge } from "@/components/admin/status-badge";
import { TeamMemberManager } from "@/components/TeamMemberManager";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useDeleteTeamMutation,
  useTeamQuery,
  useTeamsQuery,
} from "@/hooks/queries/useTeamQueries";
import { JoinPasswordDialog } from "@/pages/team-list/JoinPasswordDialog";
import { TeamFormDialog } from "@/pages/team-list/TeamFormDialog";
import type { Team, TeamStatus } from "@/types/team";
import { formatDateTime } from "@/utils/format";

const statusLabels: Record<TeamStatus, string> = {
  active: "已启用",
  frozen: "已冻结",
  dissolved: "已解散",
};

const statusVariants: Record<TeamStatus, string> = {
  active: "success",
  frozen: "warning",
  dissolved: "secondary",
};

function sortTeams(items: Team[]) {
  return [...items].sort((left, right) =>
    left.name.localeCompare(right.name, "zh-CN"),
  );
}

function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

function CaptainCell({ team }: { team: Team }) {
  if (!team.captain) return <span className="cell-secondary">未指定</span>;
  const label =
    team.captain.real_name?.trim() ||
    team.captain.nickname.trim() ||
    `用户 ${team.captain.user_id}`;
  return <MemberCell avatarUrl={team.captain.avatar_url} name={label} />;
}

export default function TeamListPage() {
  const teamsQuery = useTeamsQuery();
  const deleteTeam = useDeleteTeamMutation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [editing, setEditing] = useState<Team | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [passwordTeam, setPasswordTeam] = useState<Team | null>(null);
  const [detailID, setDetailID] = useState<number | null>(null);
  const [memberTeam, setMemberTeam] = useState<Team | null>(null);
  const [actionError, setActionError] = useState("");
  const [deletingID, setDeletingID] = useState<number | null>(null);
  const detailQuery = useTeamQuery(detailID);
  const items = useMemo(
    () => sortTeams(teamsQuery.data || []),
    [teamsQuery.data],
  );
  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase("zh-CN");
    const statusFilter = status === "all" ? null : (status as TeamStatus);
    return items.filter((item) => {
      const matchesStatus = !statusFilter || item.status === statusFilter;
      const matchesKeyword =
        !keyword ||
        item.name.toLocaleLowerCase("zh-CN").includes(keyword) ||
        item.description?.toLocaleLowerCase("zh-CN").includes(keyword);
      return matchesStatus && Boolean(matchesKeyword);
    });
  }, [items, search, status]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (team: Team) => {
    setEditing(team);
    setFormOpen(true);
  };

  const removeTeam = async (team: Team) => {
    setDeletingID(team.id);
    setActionError("");
    try {
      await deleteTeam.mutateAsync(team.id);
      if (detailID === team.id) setDetailID(null);
      if (memberTeam?.id === team.id) setMemberTeam(null);
    } catch (reason) {
      setActionError(errorMessage(reason, "球队删除失败"));
    } finally {
      setDeletingID(null);
    }
  };

  const columns: DataTableColumn<Team>[] = [
    {
      key: "name",
      title: "球队",
      render: (team) => (
        <NameCell subtitle={`ID ${team.id}`} title={team.name} />
      ),
    },
    {
      key: "description",
      title: "简介",
      render: (team) => (
        <span className="cell-ellipsis" title={team.description || undefined}>
          {team.description || "--"}
        </span>
      ),
    },
    {
      key: "captain_id",
      title: "队长",
      width: 170,
      render: (team) => <CaptainCell team={team} />,
    },
    {
      key: "status",
      title: "状态",
      width: 100,
      render: (team) => (
        <StatusBadge
          label={statusLabels[team.status]}
          variant={statusVariants[team.status]}
        />
      ),
    },
    {
      key: "updated_at",
      title: "更新时间",
      width: 180,
      render: (team) => formatDateTime(team.updated_at),
    },
    {
      key: "actions",
      title: "操作",
      width: 216,
      render: (team) => (
        <div className="table-row-actions">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={`查看${team.name}`}
                onClick={() => setDetailID(team.id)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Eye size={15} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>查看球队</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={`管理${team.name}成员`}
                onClick={() => {
                  setDetailID(null);
                  setMemberTeam(team);
                }}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Users size={15} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>管理成员</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={`编辑${team.name}`}
                onClick={() => openEdit(team)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Pencil size={15} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>编辑球队</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                aria-label={`重置${team.name}入队密码`}
                onClick={() => setPasswordTeam(team)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <KeyRound size={15} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>重置入队密码</TooltipContent>
          </Tooltip>
          <ConfirmPopover
            confirmText="永久删除"
            destructive
            description="已用于比赛或申请的球队不能删除。"
            onConfirm={() => void removeTeam(team)}
            title={`永久删除“${team.name}”`}
          >
            <Button
              aria-label={`删除${team.name}`}
              className="text-destructive"
              disabled={deletingID === team.id}
              size="icon"
              type="button"
              variant="ghost"
            >
              <Trash2 size={15} />
            </Button>
          </ConfirmPopover>
        </div>
      ),
    },
  ];

  const listError = teamsQuery.error
    ? errorMessage(teamsQuery.error, "球队列表加载失败")
    : "";
  const visibleError = actionError || listError;
  const detail = detailQuery.data;

  return (
    <div className="content-grid">
      <Card>
        <CardHeader>
          <CardTitle>球队管理</CardTitle>
          <CardDescription>{`共 ${items.length} 支球队`}</CardDescription>
          <CardAction>
            <Button onClick={openCreate} type="button">
              <Plus size={15} />
              创建球队
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="table-card-content">
          <div className="list-toolbar">
            <Input
              aria-label="搜索球队"
              className="match-search"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索球队名称或简介"
              value={search}
            />
            <Select value={status} onValueChange={(value) => setStatus(value)}>
              <SelectTrigger className="status-filter" style={{ width: 140 }}>
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {visibleError ? (
            <ErrorAlert
              message={visibleError}
              onRetry={
                teamsQuery.isError ? () => void teamsQuery.refetch() : undefined
              }
            />
          ) : null}

          <DataTable
            columns={columns}
            emptyText="暂无球队"
            items={filteredItems}
            loading={teamsQuery.isFetching}
            rowKey={(team) => String(team.id)}
          />
        </CardContent>
      </Card>

      <TeamFormDialog
        onClose={() => setFormOpen(false)}
        open={formOpen}
        team={editing}
      />

      <JoinPasswordDialog
        onClose={() => setPasswordTeam(null)}
        team={passwordTeam}
      />

      <Sheet
        onOpenChange={(open) => {
          if (!open) setDetailID(null);
        }}
        open={Boolean(detailID)}
      >
        <SheetContent className="team-detail-sheet" side="right">
          <SheetHeader>
            <div className="sheet-header-row">
              <div>
                <SheetTitle>球队详情</SheetTitle>
                <SheetDescription>{detail?.name || ""}</SheetDescription>
              </div>
              {detail ? (
                <Button
                  onClick={() => {
                    setDetailID(null);
                    setMemberTeam(detail);
                  }}
                  type="button"
                  variant="outline"
                >
                  <Users size={15} />
                  成员管理
                </Button>
              ) : null}
            </div>
          </SheetHeader>
          <div className="sheet-body">
            {detailQuery.error ? (
              <ErrorAlert
                message={errorMessage(detailQuery.error, "球队详情加载失败")}
                onRetry={() => void detailQuery.refetch()}
              />
            ) : null}
            {detailQuery.isFetching && !detail ? (
              <div
                aria-label="加载中"
                className="route-loading"
                role="status"
              />
            ) : null}
            {detail ? (
              <DetailGrid single>
                <DetailItem label="球队名称">{detail.name}</DetailItem>
                <DetailItem label="状态">
                  <StatusBadge
                    label={statusLabels[detail.status]}
                    variant={statusVariants[detail.status]}
                  />
                </DetailItem>
                <DetailItem label="球队简介">
                  {detail.description || "--"}
                </DetailItem>
                <DetailItem label="队长">
                  {detail.captain_id ? `用户 ${detail.captain_id}` : "未指定"}
                </DetailItem>
                <DetailItem label="创建时间">
                  {formatDateTime(detail.created_at)}
                </DetailItem>
                <DetailItem label="更新时间">
                  {formatDateTime(detail.updated_at)}
                </DetailItem>
              </DetailGrid>
            ) : null}
          </div>
        </SheetContent>
      </Sheet>

      <TeamMemberManager
        onClose={() => setMemberTeam(null)}
        onTeamChange={setMemberTeam}
        open={Boolean(memberTeam)}
        team={memberTeam}
      />
    </div>
  );
}
