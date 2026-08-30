import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ConfirmPopover } from "@/components/admin/confirm-popover";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { DetailGrid, DetailItem } from "@/components/admin/detail-grid";
import { ErrorAlert } from "@/components/admin/error-alert";
import { MemberCell } from "@/components/admin/member-cell";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminSession } from "@/features/admin-session/useAdminSession";
import {
  useDeleteMatchMutation,
  useMatchQuery,
  useUpdateMatchScoreMutation,
  useUpdateMatchStatusMutation,
} from "@/hooks/queries/useMatchQueries";
import type {
  MatchRegistrationEntry,
  MatchStatus,
  RegistrationGroup,
} from "@/types/match";
import { formatDateTime } from "@/utils/format";
import {
  getPublicationModeLabel,
  matchStatusColors,
  matchStatusLabels,
  opponentStateLabels,
  registrationStatusColors,
  registrationStatusLabels,
} from "./matchLabels";

const groupLabels: Record<RegistrationGroup["kind"], string> = {
  host_team: "主队报名组",
  guest_team: "客队报名组",
  individual_opponent: "散人对手组",
};

const memberRoleLabels: Record<string, string> = {
  captain: "队长",
  leader: "领队",
  vice_captain: "副队长",
  member: "队员",
};

function JerseyColorValue({
  color,
  fallback,
  fallbackLabel,
}: {
  color: string | null;
  fallback: string;
  fallbackLabel: string;
}) {
  return (
    <span className="jersey-color-value">
      <span
        aria-hidden="true"
        className="jersey-color-swatch"
        style={{ background: color || fallback }}
      />
      {color || `未设置（默认${fallbackLabel}）`}
    </span>
  );
}

function statusActions(
  status: MatchStatus,
): Array<{ status: MatchStatus; label: string; danger?: boolean }> {
  if (status === "registering") {
    return [
      { status: "ongoing", label: "开始比赛" },
      { status: "cancelled", label: "取消比赛", danger: true },
    ];
  }
  if (status === "ongoing") {
    return [
      { status: "ended", label: "结束比赛" },
      { status: "cancelled", label: "取消比赛", danger: true },
    ];
  }
  return [];
}

/** 比分只能在比赛进行中或已结束后录入/修正。 */
function canRecordScore(status: MatchStatus) {
  return status === "ongoing" || status === "ended";
}

function parseScoreInput(
  value: string,
  fallback: number | null,
): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return fallback;
  if (!/^\d{1,3}$/.test(trimmed)) return null;
  return Number.parseInt(trimmed, 10);
}

const groupColumns: DataTableColumn<RegistrationGroup>[] = [
  {
    key: "kind",
    title: "报名组",
    render: (item) => groupLabels[item.kind],
  },
  {
    key: "team_id",
    title: "球队 ID",
    render: (item) => item.team_id || "--",
  },
  {
    key: "min_players",
    title: "最少人数",
    render: (item) => item.min_players || "--",
  },
  {
    key: "max_players",
    title: "人数上限",
    render: (item) => item.max_players || "不限",
  },
  {
    key: "status",
    title: "状态",
    render: (item) =>
      item.status === "open" ? (
        <StatusBadge label="开放" variant="info" />
      ) : item.status === "closed" ? (
        <StatusBadge label="已满" variant="secondary" />
      ) : (
        <StatusBadge label="已取消" variant="destructive" />
      ),
  },
];

function rosterColumns(
  kind: RegistrationGroup["kind"],
): DataTableColumn<MatchRegistrationEntry>[] {
  const columns: DataTableColumn<MatchRegistrationEntry>[] = [
    {
      key: "nickname",
      title: "队员",
      render: (record) => (
        <MemberCell
          avatarUrl={record.avatar_url}
          name={record.nickname || `用户 ${record.user_id}`}
          secondary={record.real_name || undefined}
        />
      ),
    },
  ];
  if (kind !== "individual_opponent") {
    columns.push({
      key: "member_role",
      title: "角色",
      render: (record) =>
        record.member_role
          ? memberRoleLabels[record.member_role] || record.member_role
          : "--",
    });
  }
  columns.push({
    key: "status",
    title: "报名状态",
    render: (record) => (
      <StatusBadge
        label={registrationStatusLabels[record.status]}
        variant={registrationStatusColors[record.status]}
      />
    ),
  });
  if (kind === "individual_opponent") {
    columns.push(
      {
        key: "registration_count",
        title: "人数",
        render: (record) =>
          record.registration_count > 1 ? (
            <StatusBadge
              label={`×${record.registration_count}`}
              variant="info"
            />
          ) : (
            <span className="cell-secondary">1</span>
          ),
      },
      {
        key: "paid",
        title: "支付",
        render: (record) =>
          record.paid ? (
            <StatusBadge label="已付" variant="success" />
          ) : (
            <StatusBadge label="未付" variant="secondary" />
          ),
      },
    );
  }
  return columns;
}

export default function MatchDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { currentAdmin } = useAdminSession();
  const detailQuery = useMatchQuery(id);
  const statusMutation = useUpdateMatchStatusMutation();
  const scoreMutation = useUpdateMatchScoreMutation();
  const deleteMutation = useDeleteMatchMutation();
  const [targetStatus, setTargetStatus] = useState<MatchStatus | null>(null);
  const [scoreDialogOpen, setScoreDialogOpen] = useState(false);
  const [hostScoreInput, setHostScoreInput] = useState("");
  const [awayScoreInput, setAwayScoreInput] = useState("");
  const [actionError, setActionError] = useState("");

  const detail = detailQuery.data;
  const match = detail?.match;
  const actions = match ? statusActions(match.status) : [];
  const orderedActions = [
    ...actions.filter((action) => action.danger),
    ...actions.filter((action) => !action.danger),
  ];

  const openScoreDialog = () => {
    setHostScoreInput(
      match?.host_score == null ? "" : String(match.host_score),
    );
    setAwayScoreInput(
      match?.away_score == null ? "" : String(match.away_score),
    );
    setActionError("");
    setScoreDialogOpen(true);
  };

  const submitScore = async () => {
    const hostScore = parseScoreInput(hostScoreInput, null);
    const awayScore = parseScoreInput(awayScoreInput, null);
    if (hostScore == null || awayScore == null) {
      setActionError("比分需为 0-999 的整数");
      return;
    }
    setActionError("");
    try {
      await scoreMutation.mutateAsync({
        id,
        payload: { host_score: hostScore, away_score: awayScore },
      });
      setScoreDialogOpen(false);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "比分录入失败");
    }
  };

  const submitStatus = async () => {
    if (!targetStatus) return;
    setActionError("");
    try {
      await statusMutation.mutateAsync({ id, status: targetStatus });
      setTargetStatus(null);
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "状态更新失败");
    }
  };

  const removeMatch = async () => {
    setActionError("");
    try {
      await deleteMutation.mutateAsync(id);
      navigate("/matches", { replace: true });
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "删除比赛失败");
    }
  };

  const queryError =
    detailQuery.error instanceof Error ? detailQuery.error.message : "";
  const error = actionError || queryError;

  return (
    <div className="content-grid">
      <Card>
        <CardHeader>
          <div className="detail-heading">
            <Button
              aria-label="返回比赛列表"
              onClick={() => navigate("/matches")}
              size="icon"
              type="button"
              variant="outline"
            >
              <ArrowLeft size={16} />
            </Button>
            <div>
              <CardTitle>{match?.name || "比赛详情"}</CardTitle>
              {match ? (
                <CardDescription className="detail-status-line">
                  <StatusBadge
                    label={matchStatusLabels[match.status]}
                    variant={matchStatusColors[match.status]}
                  />
                  <StatusBadge
                    label={getPublicationModeLabel(match.publication_mode)}
                    variant="secondary"
                  />
                  <span className="cell-secondary">
                    {opponentStateLabels[match.opponent_state]}
                  </span>
                </CardDescription>
              ) : null}
            </div>
          </div>
          {match ? (
            <CardAction>
              <div className="toolbar">
                {actions.length ? (
                  <Button
                    onClick={() => navigate(`/matches/${id}/edit`)}
                    type="button"
                    variant="outline"
                  >
                    <Pencil size={15} />
                    编辑
                  </Button>
                ) : null}
                {canRecordScore(match.status) ? (
                  <Button
                    onClick={openScoreDialog}
                    type="button"
                    variant="outline"
                  >
                    录入比分
                  </Button>
                ) : null}
                {orderedActions.map((action) => (
                  <Button
                    key={action.status}
                    onClick={() => setTargetStatus(action.status)}
                    type="button"
                    variant={action.danger ? "destructive" : "default"}
                  >
                    {action.label}
                  </Button>
                ))}
                {currentAdmin?.is_super_admin ? (
                  <ConfirmPopover
                    confirmText="永久删除"
                    destructive
                    description="比赛及其报名、申请数据将永久删除。"
                    onConfirm={() => void removeMatch()}
                    title={`永久删除“${match.name}”`}
                  >
                    <Button
                      disabled={deleteMutation.isPending}
                      type="button"
                      variant="outline"
                    >
                      <Trash2 size={15} />
                      删除
                    </Button>
                  </ConfirmPopover>
                ) : null}
              </div>
            </CardAction>
          ) : null}
        </CardHeader>
        <CardContent>
          {error ? (
            <ErrorAlert
              message={error}
              onRetry={
                detailQuery.isError
                  ? () => void detailQuery.refetch()
                  : undefined
              }
            />
          ) : null}

          {detailQuery.isLoading ? (
            <div aria-label="加载中" className="route-loading" role="status" />
          ) : null}

          {match ? (
            <DetailGrid>
              <DetailItem label="主队">{match.host_team_name}</DetailItem>
              <DetailItem label="对手">
                {match.away_team_name || match.opponent_name || "待确认"}
              </DetailItem>
              <DetailItem label="比分">
                {match.host_score == null || match.away_score == null ? (
                  <span className="cell-secondary">未录入</span>
                ) : (
                  <strong>
                    {match.host_team_name} {match.host_score} :{" "}
                    {match.away_score}{" "}
                    {match.away_team_name || match.opponent_name || "客队"}
                  </strong>
                )}
              </DetailItem>
              <DetailItem label="每队人数">
                {match.players_per_team} 人
              </DetailItem>
              <DetailItem label="主队球服">
                <JerseyColorValue
                  color={match.host_color}
                  fallback="#FFFFFF"
                  fallbackLabel="白"
                />
              </DetailItem>
              <DetailItem label="客队球服">
                <JerseyColorValue
                  color={match.away_color}
                  fallback="#FF0000"
                  fallbackLabel="红"
                />
              </DetailItem>
              <DetailItem label="比赛场地">{match.location}</DetailItem>
              <DetailItem label="开始时间">
                {formatDateTime(match.start_time)}
              </DetailItem>
              <DetailItem label="结束时间">
                {formatDateTime(match.end_time)}
              </DetailItem>
              <DetailItem label="报名开始时间">
                {match.registration_start_at
                  ? formatDateTime(match.registration_start_at)
                  : "未设置"}
              </DetailItem>
              <DetailItem label="报名截止时间">
                {match.registration_end_at
                  ? formatDateTime(match.registration_end_at)
                  : "未设置"}
              </DetailItem>
              <DetailItem full label="比赛说明">
                {match.description || "无"}
              </DetailItem>
            </DetailGrid>
          ) : null}
        </CardContent>
      </Card>

      {detail ? (
        <>
          <Card>
            <CardHeader>
              <CardTitle>报名组</CardTitle>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={groupColumns}
                items={detail.groups}
                loading={false}
                rowKey={(item) => String(item.id)}
              />
            </CardContent>
          </Card>

          {detail.groups.map((group) => (
            <Card key={group.id}>
              <CardHeader>
                <CardTitle>{`${groupLabels[group.kind]} · 队员报名`}</CardTitle>
              </CardHeader>
              <CardContent>
                <DataTable
                  columns={rosterColumns(group.kind)}
                  emptyText="暂无报名记录"
                  items={group.registrations}
                  loading={false}
                  rowKey={(record) => String(record.user_id)}
                />
              </CardContent>
            </Card>
          ))}
        </>
      ) : null}

      <Dialog
        onOpenChange={(open) => {
          if (!open) setTargetStatus(null);
        }}
        open={Boolean(targetStatus)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认变更比赛状态</DialogTitle>
            <DialogDescription>
              比赛将变更为“{targetStatus ? matchStatusLabels[targetStatus] : ""}
              ”，该状态流转不可回退。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setTargetStatus(null)}
              type="button"
              variant="outline"
            >
              返回
            </Button>
            <Button
              disabled={statusMutation.isPending}
              onClick={() => void submitStatus()}
              type="button"
              variant={targetStatus === "cancelled" ? "destructive" : "default"}
            >
              确认
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setScoreDialogOpen} open={scoreDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>录入比赛比分</DialogTitle>
            <DialogDescription>
              比赛进行中与结束后均可录入；重复提交会覆盖此前的比分。
            </DialogDescription>
          </DialogHeader>
          <div className="score-input-row">
            <div className="score-input-field">
              <Label htmlFor="match-host-score">
                {match?.host_team_name || "主队"}
              </Label>
              <Input
                id="match-host-score"
                inputMode="numeric"
                onChange={(event) => setHostScoreInput(event.target.value)}
                placeholder="0"
                value={hostScoreInput}
              />
            </div>
            <span className="score-input-separator">:</span>
            <div className="score-input-field">
              <Label htmlFor="match-away-score">
                {match?.away_team_name || match?.opponent_name || "客队"}
              </Label>
              <Input
                id="match-away-score"
                inputMode="numeric"
                onChange={(event) => setAwayScoreInput(event.target.value)}
                placeholder="0"
                value={awayScoreInput}
              />
            </div>
          </div>
          {actionError && !targetStatus ? (
            <p className="score-input-error" role="alert">
              {actionError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              onClick={() => setScoreDialogOpen(false)}
              type="button"
              variant="outline"
            >
              取消
            </Button>
            <Button
              disabled={scoreMutation.isPending}
              onClick={() => void submitScore()}
              type="button"
            >
              保存比分
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
