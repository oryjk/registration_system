import DeleteOutlined from "@ant-design/icons/es/icons/DeleteOutlined";
import EyeOutlined from "@ant-design/icons/es/icons/EyeOutlined";
import PlusOutlined from "@ant-design/icons/es/icons/PlusOutlined";
import StopOutlined from "@ant-design/icons/es/icons/StopOutlined";
import Alert from "antd/es/alert";
import Button from "antd/es/button";
import Grid from "antd/es/grid";
import Input from "antd/es/input";
import Popconfirm from "antd/es/popconfirm";
import Select from "antd/es/select";
import Space from "antd/es/space";
import Table from "antd/es/table";
import Tag from "antd/es/tag";
import Tooltip from "antd/es/tooltip";
import Typography from "antd/es/typography";
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { deleteMatch, listMatches, updateMatchStatus } from "../api/matches";
import { useAuth } from "../auth/useAuth";
import type { MatchItem, MatchStatus } from "../types/match";
import {
  matchStatusColors,
  matchStatusLabels,
  publicationModeLabels,
} from "./matchLabels";

const { Search } = Input;
const { Text, Title } = Typography;
const alwaysApply = () => true;

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export default function MatchListPage() {
  const navigate = useNavigate();
  const { admin } = useAuth();
  const screens = Grid.useBreakpoint();
  const compact = !(screens.md ?? false);
  const [items, setItems] = useState<MatchItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<MatchStatus | undefined>();
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionKey, setActionKey] = useState("");

  const load = useCallback(
    (shouldApply = alwaysApply) => {
      if (shouldApply()) {
        setLoading(true);
        setError("");
      }
      return listMatches({ page, page_size: pageSize, status, search })
        .then((result) => {
          if (!shouldApply()) return;
          setItems(result.items);
          setTotal(result.total);
        })
        .catch((reason) => {
          if (shouldApply())
            setError(
              reason instanceof Error ? reason.message : "比赛列表加载失败",
            );
        })
        .finally(() => {
          if (shouldApply()) setLoading(false);
        });
    },
    [page, pageSize, search, status],
  );

  useEffect(() => {
    let active = true;
    void load(() => active);
    return () => {
      active = false;
    };
  }, [load]);

  const cancelMatch = async (item: MatchItem) => {
    const key = `cancel:${item.id}`;
    setActionKey(key);
    setError("");
    try {
      const updated = await updateMatchStatus(item.id, "cancelled");
      setItems((current) =>
        current.map((candidate) =>
          candidate.id === item.id ? updated.match : candidate,
        ),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "取消比赛失败");
    } finally {
      setActionKey("");
    }
  };

  const removeMatch = async (item: MatchItem) => {
    const key = `delete:${item.id}`;
    setActionKey(key);
    setError("");
    try {
      await deleteMatch(item.id);
      setItems((current) =>
        current.filter((candidate) => candidate.id !== item.id),
      );
      setTotal((current) => Math.max(0, current - 1));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "删除比赛失败");
    } finally {
      setActionKey("");
    }
  };

  const columns = [
    {
      title: "比赛",
      dataIndex: "name",
      render: (_: string, item: MatchItem) => (
        <div className="match-name-cell">
          <strong>{item.name}</strong>
          <Text type="secondary">
            {publicationModeLabels[item.publication_mode]}
          </Text>
        </div>
      ),
    },
    ...(compact
      ? []
      : [
          { title: "主队", dataIndex: "host_team_name", width: 160 },
          { title: "场地", dataIndex: "location", width: 180, ellipsis: true },
        ]),
    {
      title: "开赛时间",
      dataIndex: "start_time",
      width: compact ? 120 : 150,
      render: formatDateTime,
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (value: MatchStatus) => (
        <Tag color={matchStatusColors[value]}>{matchStatusLabels[value]}</Tag>
      ),
    },
    {
      title: "",
      key: "action",
      width: admin?.is_super_admin ? 144 : 104,
      fixed: "right" as const,
      render: (_: unknown, item: MatchItem) => (
        <Space size={2}>
          <Tooltip title="查看比赛">
            <Button
              type="text"
              shape="circle"
              icon={<EyeOutlined />}
              aria-label={`查看${item.name}`}
              onClick={() => navigate(`/matches/${item.id}`)}
            />
          </Tooltip>
          {item.status === "registering" || item.status === "ongoing" ? (
            <Popconfirm
              title={`取消“${item.name}”`}
              description="比赛取消后不可恢复。"
              okText="确认取消"
              cancelText="返回"
              onConfirm={() => void cancelMatch(item)}
            >
              <Tooltip title="取消比赛">
                <Button
                  type="text"
                  shape="circle"
                  danger
                  icon={<StopOutlined />}
                  loading={actionKey === `cancel:${item.id}`}
                  aria-label={`取消${item.name}`}
                />
              </Tooltip>
            </Popconfirm>
          ) : null}
          {admin?.is_super_admin ? (
            <Popconfirm
              title={`永久删除“${item.name}”`}
              description="比赛及其报名、申请数据将永久删除。"
              okText="永久删除"
              okButtonProps={{ danger: true }}
              cancelText="返回"
              onConfirm={() => void removeMatch(item)}
            >
              <Tooltip title="永久删除">
                <Button
                  type="text"
                  shape="circle"
                  danger
                  icon={<DeleteOutlined />}
                  loading={actionKey === `delete:${item.id}`}
                  aria-label={`删除${item.name}`}
                />
              </Tooltip>
            </Popconfirm>
          ) : null}
        </Space>
      ),
    },
  ];

  return (
    <main className="match-list-page">
      <section className="page-heading">
        <div>
          <Text className="page-kicker">MATCH OPERATIONS</Text>
          <Title level={2}>比赛管理</Title>
          <Text type="secondary">共 {total} 场比赛</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate("/matches/new")}
        >
          发布比赛
        </Button>
      </section>

      <section className="list-toolbar">
        <Search
          allowClear
          placeholder="搜索比赛、场地或主队"
          className="match-search"
          onSearch={(value) => {
            setPage(1);
            setSearch(value.trim());
          }}
        />
        <Select<MatchStatus>
          allowClear
          placeholder="全部状态"
          className="status-filter"
          value={status}
          options={Object.entries(matchStatusLabels).map(([value, label]) => ({
            value: value as MatchStatus,
            label,
          }))}
          onChange={(value) => {
            setPage(1);
            setStatus(value);
          }}
        />
      </section>

      {error ? (
        <Alert
          className="service-alert"
          type="error"
          showIcon
          message={error}
          action={
            <Button size="small" onClick={() => void load()}>
              重试
            </Button>
          }
        />
      ) : null}

      <section className="table-panel match-table-panel">
        <Table<MatchItem>
          rowKey="id"
          loading={loading}
          dataSource={items}
          columns={columns}
          scroll={{ x: compact ? 620 : 900 }}
          onRow={(item) => ({
            onDoubleClick: () => navigate(`/matches/${item.id}`),
          })}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (value) => `共 ${value} 场`,
            onChange: (nextPage, nextSize) => {
              setPage(nextPage);
              setPageSize(nextSize);
            },
          }}
        />
      </section>
    </main>
  );
}
