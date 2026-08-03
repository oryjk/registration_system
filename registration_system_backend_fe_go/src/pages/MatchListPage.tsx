import DeleteOutlined from "@ant-design/icons/es/icons/DeleteOutlined";
import EyeOutlined from "@ant-design/icons/es/icons/EyeOutlined";
import PlusOutlined from "@ant-design/icons/es/icons/PlusOutlined";
import StopOutlined from "@ant-design/icons/es/icons/StopOutlined";
import { PageContainer } from "@ant-design/pro-components/es/layout/components/PageContainer";
import ProTable, { type ProColumns } from "@ant-design/pro-components/es/table";
import Alert from "antd/es/alert";
import Button from "antd/es/button";
import Grid from "antd/es/grid";
import Input from "antd/es/input";
import Popconfirm from "antd/es/popconfirm";
import Select from "antd/es/select";
import Space from "antd/es/space";
import Tag from "antd/es/tag";
import Tooltip from "antd/es/tooltip";
import Typography from "antd/es/typography";
import { useEffect, useState } from "react";
import { history, useLocation, useModel } from "umi";
import {
  useDeleteMatchMutation,
  useMatchesQuery,
  useUpdateMatchStatusMutation,
} from "../hooks/queries/useMatchQueries";
import type { MatchItem, MatchListQuery, MatchStatus } from "../types/match";
import {
  parseMatchListQuery,
  serializeMatchListQuery,
} from "../utils/match-list-query";
import {
  matchStatusColors,
  matchStatusLabels,
  publicationModeLabels,
} from "./matchLabels";

const { Search } = Input;
const { Text } = Typography;

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
  const location = useLocation();
  const query = parseMatchListQuery(location.search);
  const matches = useMatchesQuery(query);
  const updateStatus = useUpdateMatchStatusMutation();
  const deleteMatch = useDeleteMatchMutation();
  const { initialState } = useModel("@@initialState");
  const screens = Grid.useBreakpoint();
  const compact = !(screens.md ?? false);
  const [searchDraft, setSearchDraft] = useState(query.search || "");
  const [actionKey, setActionKey] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    setSearchDraft(query.search || "");
  }, [query.search]);

  const updateQuery = (changes: Partial<MatchListQuery>) => {
    const next = { ...query, ...changes };
    history.push(`/matches${serializeMatchListQuery(next)}`);
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

  const columns: ProColumns<MatchItem>[] = [
    {
      title: "比赛",
      dataIndex: "name",
      render: (_, item) => (
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
      renderText: formatDateTime,
    },
    {
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (_, item) => (
        <Tag color={matchStatusColors[item.status]}>
          {matchStatusLabels[item.status]}
        </Tag>
      ),
    },
    {
      title: "操作",
      key: "action",
      valueType: "option",
      width: initialState?.currentAdmin?.is_super_admin ? 144 : 104,
      fixed: "right",
      render: (_, item) => (
        <Space size={2}>
          <Tooltip title="查看比赛">
            <Button
              type="text"
              shape="circle"
              icon={<EyeOutlined />}
              aria-label={`查看${item.name}`}
              onClick={() => history.push(`/matches/${item.id}`)}
            />
          </Tooltip>
          {item.status === "registering" || item.status === "ongoing" ? (
            <Popconfirm
              title={`取消“${item.name}”`}
              description="比赛取消后不可恢复。"
              okText="确认取消"
              cancelText="返回"
              onConfirm={() => cancelMatch(item)}
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
          {initialState?.currentAdmin?.is_super_admin ? (
            <Popconfirm
              title={`永久删除“${item.name}”`}
              description="比赛及其报名、申请数据将永久删除。"
              okText="永久删除"
              okButtonProps={{ danger: true }}
              cancelText="返回"
              onConfirm={() => removeMatch(item)}
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

  const queryError =
    matches.error instanceof Error ? matches.error.message : "";
  const error = actionError || queryError;

  return (
    <PageContainer
      title="比赛管理"
      content={`共 ${matches.data?.total || 0} 场比赛`}
      extra={
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => history.push("/matches/new")}
        >
          发布比赛
        </Button>
      }
    >
      <div className="list-toolbar">
        <Search
          allowClear
          placeholder="搜索比赛、场地或主队"
          className="match-search"
          value={searchDraft}
          onChange={(event) => setSearchDraft(event.target.value)}
          onSearch={(value) => updateQuery({ page: 1, search: value.trim() })}
        />
        <Select<MatchStatus>
          allowClear
          placeholder="全部状态"
          className="status-filter"
          value={query.status}
          options={Object.entries(matchStatusLabels).map(([value, label]) => ({
            value: value as MatchStatus,
            label,
          }))}
          onChange={(status) => updateQuery({ page: 1, status })}
        />
      </div>

      {error ? (
        <Alert
          className="service-alert"
          type="error"
          showIcon
          message={error}
          action={
            matches.isError ? (
              <Button size="small" onClick={() => void matches.refetch()}>
                重试
              </Button>
            ) : null
          }
        />
      ) : null}

      <ProTable<MatchItem>
        rowKey="id"
        search={false}
        options={false}
        cardProps={{ className: "match-table-panel" }}
        loading={matches.isFetching}
        dataSource={matches.data?.items || []}
        columns={columns}
        scroll={{ x: compact ? 620 : 900 }}
        onRow={(item) => ({
          onDoubleClick: () => history.push(`/matches/${item.id}`),
        })}
        pagination={{
          current: query.page,
          pageSize: query.page_size,
          total: matches.data?.total || 0,
          showSizeChanger: true,
          showTotal: (value) => `共 ${value} 场`,
          onChange: (page, pageSize) =>
            updateQuery({
              page: pageSize === query.page_size ? page : 1,
              page_size: pageSize,
            }),
        }}
      />
    </PageContainer>
  );
}
