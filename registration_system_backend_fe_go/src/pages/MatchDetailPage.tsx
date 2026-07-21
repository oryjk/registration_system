import ArrowLeftOutlined from "@ant-design/icons/es/icons/ArrowLeftOutlined";
import EditOutlined from "@ant-design/icons/es/icons/EditOutlined";
import Alert from "antd/es/alert";
import Avatar from "antd/es/avatar";
import Button from "antd/es/button";
import Descriptions from "antd/es/descriptions";
import Modal from "antd/es/modal";
import Space from "antd/es/space";
import Table from "antd/es/table";
import type { ColumnsType } from "antd/es/table";
import Tag from "antd/es/tag";
import Typography from "antd/es/typography";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getMatch, updateMatchStatus } from "../api/matches";
import type { MatchDetail, MatchRegistrationEntry, MatchRegistrationStatus, MatchStatus, RegistrationGroup } from "../types/match";
import { matchStatusColors, matchStatusLabels, opponentStateLabels, publicationModeLabels, registrationStatusColors, registrationStatusLabels } from "./matchLabels";

const { Text, Title } = Typography;
const alwaysApply = () => true;

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

function rosterColumns(kind: RegistrationGroup["kind"]): ColumnsType<MatchRegistrationEntry> {
  const columns: ColumnsType<MatchRegistrationEntry> = [
    {
      title: "队员",
      dataIndex: "nickname",
      render: (_, record) => (
        <Space>
          <Avatar src={record.avatar_url || undefined}>{(record.nickname || String(record.user_id)).slice(0, 1)}</Avatar>
          <span>{record.nickname || `用户 ${record.user_id}`}</span>
          {record.real_name ? <Text type="secondary">{record.real_name}</Text> : null}
        </Space>
      ),
    },
  ];
  if (kind !== "individual_opponent") {
    columns.push({
      title: "角色",
      dataIndex: "member_role",
      render: (value: string | null) => (value ? memberRoleLabels[value] || value : "--"),
    });
  }
  columns.push({
    title: "报名状态",
    dataIndex: "status",
    render: (value: MatchRegistrationStatus) => <Tag color={registrationStatusColors[value]}>{registrationStatusLabels[value]}</Tag>,
  });
  return columns;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function statusActions(status: MatchStatus): Array<{ status: MatchStatus; label: string; danger?: boolean }> {
  if (status === "registering") return [{ status: "ongoing", label: "开始比赛" }, { status: "cancelled", label: "取消比赛", danger: true }];
  if (status === "ongoing") return [{ status: "ended", label: "结束比赛" }, { status: "cancelled", label: "取消比赛", danger: true }];
  return [];
}

export default function MatchDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [targetStatus, setTargetStatus] = useState<MatchStatus | null>(null);
  const [updating, setUpdating] = useState(false);

  const load = useCallback((shouldApply = alwaysApply) => {
    if (shouldApply()) {
      setLoading(true);
      setError("");
    }
    return getMatch(id)
      .then((result) => {
        if (shouldApply()) setDetail(result);
      })
      .catch((reason) => {
        if (shouldApply()) setError(reason instanceof Error ? reason.message : "比赛详情加载失败");
      })
      .finally(() => {
        if (shouldApply()) setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    let active = true;
    void load(() => active);
    return () => {
      active = false;
    };
  }, [load]);

  const submitStatus = async () => {
    if (!targetStatus) return;
    setUpdating(true);
    setError("");
    try {
      const result = await updateMatchStatus(id, targetStatus);
      setDetail(result);
      setTargetStatus(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "状态更新失败");
    } finally {
      setUpdating(false);
    }
  };

  if (!detail && loading) return <div className="route-loading" />;

  const match = detail?.match;
  const actions = match ? statusActions(match.status) : [];
  const orderedActions = [...actions.filter((action) => action.danger), ...actions.filter((action) => !action.danger)];
  return (
    <main className={`match-detail-page${actions.length ? " has-fixed-actions" : ""}`}>
      <section className="page-heading detail-heading">
        <div className="detail-title-row">
          <Button type="text" shape="circle" icon={<ArrowLeftOutlined />} aria-label="返回比赛列表" onClick={() => navigate("/matches")} />
          <div>
            <Text className="page-kicker">MATCH DETAIL</Text>
            <Title level={2}>{match?.name || "比赛详情"}</Title>
          </div>
        </div>
        {match && actions.length ? (
          <Space className="detail-actions" size={8} role="group" aria-label="比赛操作">
            <Button icon={<EditOutlined />} onClick={() => navigate(`/matches/${id}/edit`)}>编辑</Button>
            {orderedActions.map((action) => (
              <Button key={action.status} danger={action.danger} type={action.danger ? "default" : "primary"} onClick={() => setTargetStatus(action.status)}>
                {action.label}
              </Button>
            ))}
          </Space>
        ) : null}
      </section>

      {error ? <Alert className="service-alert" type="error" showIcon message={error} /> : null}

      {match ? (
        <>
          <section className="detail-panel">
            <div className="detail-status-line">
              <Tag color={matchStatusColors[match.status]}>{matchStatusLabels[match.status]}</Tag>
              <Text>{publicationModeLabels[match.publication_mode]}</Text>
              <Text type="secondary">{opponentStateLabels[match.opponent_state]}</Text>
            </div>
            <Descriptions column={{ xs: 1, sm: 2, lg: 3 }} colon={false}>
              <Descriptions.Item label="主队">{match.host_team_name}</Descriptions.Item>
              <Descriptions.Item label="对手">{match.away_team_name || match.opponent_name || "待确认"}</Descriptions.Item>
              <Descriptions.Item label="每队人数">{match.players_per_team} 人</Descriptions.Item>
              <Descriptions.Item label="开始时间">{formatDateTime(match.start_time)}</Descriptions.Item>
              <Descriptions.Item label="结束时间">{formatDateTime(match.end_time)}</Descriptions.Item>
              <Descriptions.Item label="比赛场地">{match.location}</Descriptions.Item>
              <Descriptions.Item label="比赛说明" span={3}>{match.description || "无"}</Descriptions.Item>
            </Descriptions>
          </section>

          <section className="table-panel group-table-panel">
            <header className="panel-header">
              <div><Text className="panel-kicker">REGISTRATION GROUPS</Text><Title level={4}>报名组</Title></div>
            </header>
            <Table<RegistrationGroup>
              rowKey="id"
              pagination={false}
              dataSource={detail?.groups || []}
              columns={[
                { title: "报名组", dataIndex: "kind", render: (value) => groupLabels[value as RegistrationGroup["kind"]] },
                { title: "球队 ID", dataIndex: "team_id", render: (value) => value || "--" },
                { title: "最少人数", dataIndex: "min_players", render: (value) => value || "--" },
                { title: "人数上限", dataIndex: "max_players", render: (value) => value || "不限" },
                { title: "状态", dataIndex: "status", render: (value) => <Tag>{value === "open" ? "开放" : value === "closed" ? "已满" : "已取消"}</Tag> },
              ]}
            />
          </section>

          {(detail?.groups || []).map((group) => (
            <section key={group.id} className="table-panel roster-table-panel">
              <header className="panel-header">
                <div><Text className="panel-kicker">ROSTER</Text><Title level={4}>{groupLabels[group.kind]} · 队员报名</Title></div>
              </header>
              <Table<MatchRegistrationEntry>
                rowKey="user_id"
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
        confirmLoading={updating}
        okButtonProps={{ danger: targetStatus === "cancelled" }}
        onOk={() => void submitStatus()}
        onCancel={() => setTargetStatus(null)}
      >
        <Text>比赛将变更为“{targetStatus ? matchStatusLabels[targetStatus] : ""}”，该状态流转不可回退。</Text>
      </Modal>
    </main>
  );
}
