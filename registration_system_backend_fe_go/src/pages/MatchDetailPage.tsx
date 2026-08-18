import { DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { PageContainer } from "@ant-design/pro-components/es/layout/components/PageContainer";
import ProTable, { type ProColumns } from "@ant-design/pro-components/es/table";
import {
  Alert,
  Avatar,
  Button,
  ColorPicker,
  Descriptions,
  Modal,
  Popconfirm,
  Space,
  Tag,
  Typography,
} from "antd";
import { useState } from "react";
import { history, useModel, useParams } from "umi";
import {
  useDeleteMatchMutation,
  useMatchQuery,
  useUpdateMatchStatusMutation,
} from "../hooks/queries/useMatchQueries";
import type {
  MatchRegistrationEntry,
  MatchStatus,
  RegistrationGroup,
} from "../types/match";
import {
  getPublicationModeLabel,
  matchStatusColors,
  matchStatusLabels,
  opponentStateLabels,
  registrationStatusColors,
  registrationStatusLabels,
} from "./matchLabels";

const { Text } = Typography;

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

function rosterColumns(
  kind: RegistrationGroup["kind"],
): ProColumns<MatchRegistrationEntry>[] {
  const columns: ProColumns<MatchRegistrationEntry>[] = [
    {
      title: "队员",
      dataIndex: "nickname",
      render: (_, record) => (
        <Space>
          <Avatar src={record.avatar_url || undefined}>
            {(record.nickname || String(record.user_id)).slice(0, 1)}
          </Avatar>
          <span>{record.nickname || `用户 ${record.user_id}`}</span>
          {record.real_name ? (
            <Text type="secondary">{record.real_name}</Text>
          ) : null}
        </Space>
      ),
    },
  ];
  if (kind !== "individual_opponent") {
    columns.push({
      title: "角色",
      dataIndex: "member_role",
      renderText: (value: string | null) =>
        value ? memberRoleLabels[value] || value : "--",
    });
  }
  columns.push({
    title: "报名状态",
    dataIndex: "status",
    render: (_, record) => (
      <Tag color={registrationStatusColors[record.status]}>
        {registrationStatusLabels[record.status]}
      </Tag>
    ),
  });
  return columns;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

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
    <Space size={8}>
      <ColorPicker value={color || fallback} disabled disabledAlpha />
      <span>{color || `未设置（默认${fallbackLabel}）`}</span>
    </Space>
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

const groupColumns: ProColumns<RegistrationGroup>[] = [
  {
    title: "报名组",
    dataIndex: "kind",
    renderText: (value: RegistrationGroup["kind"]) => groupLabels[value],
  },
  {
    title: "球队 ID",
    dataIndex: "team_id",
    renderText: (value: number | null) => value || "--",
  },
  {
    title: "最少人数",
    dataIndex: "min_players",
    renderText: (value: number | null) => value || "--",
  },
  {
    title: "人数上限",
    dataIndex: "max_players",
    renderText: (value: number | null) => value || "不限",
  },
  {
    title: "状态",
    dataIndex: "status",
    render: (_, record) => (
      <Tag>
        {record.status === "open"
          ? "开放"
          : record.status === "closed"
            ? "已满"
            : "已取消"}
      </Tag>
    ),
  },
];

export default function MatchDetailPage() {
  const { id = "" } = useParams();
  const { initialState } = useModel("@@initialState");
  const detailQuery = useMatchQuery(id);
  const statusMutation = useUpdateMatchStatusMutation();
  const deleteMutation = useDeleteMatchMutation();
  const [targetStatus, setTargetStatus] = useState<MatchStatus | null>(null);
  const [actionError, setActionError] = useState("");

  const detail = detailQuery.data;
  const match = detail?.match;
  const actions = match ? statusActions(match.status) : [];
  const orderedActions = [
    ...actions.filter((action) => action.danger),
    ...actions.filter((action) => !action.danger),
  ];

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
      history.replace("/matches");
    } catch (reason) {
      setActionError(reason instanceof Error ? reason.message : "删除比赛失败");
    }
  };

  const queryError =
    detailQuery.error instanceof Error ? detailQuery.error.message : "";
  const error = actionError || queryError;

  return (
    <PageContainer
      className={`match-detail-page${actions.length ? " has-fixed-actions" : ""}`}
      title={match?.name || "比赛详情"}
      onBack={() => history.push("/matches")}
      extra={
        match ? (
          <Space className="detail-actions" size={8} aria-label="比赛操作">
            {actions.length ? (
              <Button
                icon={<EditOutlined />}
                onClick={() => history.push(`/matches/${id}/edit`)}
              >
                编辑
              </Button>
            ) : null}
            {orderedActions.map((action) => (
              <Button
                key={action.status}
                danger={action.danger}
                type={action.danger ? "default" : "primary"}
                onClick={() => setTargetStatus(action.status)}
              >
                {action.label}
              </Button>
            ))}
            {initialState?.currentAdmin?.is_super_admin ? (
              <Popconfirm
                title={`永久删除“${match.name}”`}
                description="比赛及其报名、申请数据将永久删除。"
                okText="永久删除"
                okButtonProps={{ danger: true }}
                cancelText="返回"
                onConfirm={removeMatch}
              >
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  loading={deleteMutation.isPending}
                >
                  删除
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        ) : null
      }
    >
      {error ? (
        <Alert
          className="service-alert"
          type="error"
          showIcon
          message={error}
          action={
            detailQuery.isError ? (
              <Button size="small" onClick={() => void detailQuery.refetch()}>
                重试
              </Button>
            ) : null
          }
        />
      ) : null}

      {detailQuery.isLoading ? <div className="route-loading" /> : null}

      {match ? (
        <>
          <section className="detail-panel">
            <div className="detail-status-line">
              <Tag color={matchStatusColors[match.status]}>
                {matchStatusLabels[match.status]}
              </Tag>
              <Tag>{getPublicationModeLabel(match.publication_mode)}</Tag>
              <Text type="secondary">
                {opponentStateLabels[match.opponent_state]}
              </Text>
            </div>
            <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} colon={false}>
              <Descriptions.Item label="主队">
                {match.host_team_name}
              </Descriptions.Item>
              <Descriptions.Item label="比赛类型">
                {getPublicationModeLabel(match.publication_mode)}
              </Descriptions.Item>
              <Descriptions.Item label="对手">
                {match.away_team_name || match.opponent_name || "待确认"}
              </Descriptions.Item>
              <Descriptions.Item label="主队球服">
                <JerseyColorValue
                  color={match.host_color}
                  fallback="#FFFFFF"
                  fallbackLabel="白"
                />
              </Descriptions.Item>
              <Descriptions.Item label="客队球服">
                <JerseyColorValue
                  color={match.away_color}
                  fallback="#FF0000"
                  fallbackLabel="红"
                />
              </Descriptions.Item>
              <Descriptions.Item label="每队人数">
                {match.players_per_team} 人
              </Descriptions.Item>
              <Descriptions.Item label="开始时间">
                {formatDateTime(match.start_time)}
              </Descriptions.Item>
              <Descriptions.Item label="结束时间">
                {formatDateTime(match.end_time)}
              </Descriptions.Item>
              <Descriptions.Item label="报名开始时间">
                {match.registration_start_at
                  ? formatDateTime(match.registration_start_at)
                  : "未设置"}
              </Descriptions.Item>
              <Descriptions.Item label="报名截止时间">
                {match.registration_end_at
                  ? formatDateTime(match.registration_end_at)
                  : "未设置"}
              </Descriptions.Item>
              <Descriptions.Item label="比赛场地">
                {match.location}
              </Descriptions.Item>
              <Descriptions.Item label="比赛说明" span="filled">
                {match.description || "无"}
              </Descriptions.Item>
            </Descriptions>
          </section>

          <section className="table-panel group-table-panel">
            <ProTable<RegistrationGroup>
              rowKey="id"
              headerTitle="报名组"
              search={false}
              options={false}
              cardProps={false}
              pagination={false}
              dataSource={detail.groups}
              columns={groupColumns}
            />
          </section>

          {detail.groups.map((group) => (
            <section key={group.id} className="table-panel roster-table-panel">
              <ProTable<MatchRegistrationEntry>
                rowKey="user_id"
                headerTitle={`${groupLabels[group.kind]} · 队员报名`}
                search={false}
                options={false}
                cardProps={false}
                pagination={false}
                dataSource={group.registrations}
                locale={{ emptyText: "暂无报名记录" }}
                columns={rosterColumns(group.kind)}
              />
            </section>
          ))}
        </>
      ) : null}

      <Modal
        open={Boolean(targetStatus)}
        title="确认变更比赛状态"
        okText="确认"
        cancelText="返回"
        confirmLoading={statusMutation.isPending}
        okButtonProps={{ danger: targetStatus === "cancelled" }}
        onOk={() => void submitStatus()}
        onCancel={() => setTargetStatus(null)}
      >
        <Text>
          比赛将变更为“{targetStatus ? matchStatusLabels[targetStatus] : ""}
          ”，该状态流转不可回退。
        </Text>
      </Modal>
    </PageContainer>
  );
}
