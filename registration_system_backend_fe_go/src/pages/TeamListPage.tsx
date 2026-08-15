import {
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  PlusOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { ModalForm } from "@ant-design/pro-components/es/form/layouts/ModalForm";
import { PageContainer } from "@ant-design/pro-components/es/layout/components/PageContainer";
import ProTable, { type ProColumns } from "@ant-design/pro-components/es/table";
import {
  Alert,
  Avatar,
  Button,
  Descriptions,
  Drawer,
  Form,
  Grid,
  Input,
  Popconfirm,
  Segmented,
  Select,
  Space,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import { useMemo, useState } from "react";
import { TeamMemberManager } from "../components/TeamMemberManager";
import {
  useCreateTeamMutation,
  useDeleteTeamMutation,
  useTeamQuery,
  useTeamsQuery,
  useUpdateTeamMutation,
} from "../hooks/queries/useTeamQueries";
import type { SaveTeamPayload, Team, TeamStatus } from "../types/team";

const { Search } = Input;
const { Text } = Typography;

interface TeamFormValues {
  name: string;
  description?: string;
  status: TeamStatus;
}

const statusLabels: Record<TeamStatus, string> = {
  active: "已启用",
  frozen: "已冻结",
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function sortTeams(items: Team[]) {
  return [...items].sort((left, right) =>
    left.name.localeCompare(right.name, "zh-CN"),
  );
}

function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

export default function TeamListPage() {
  const screens = Grid.useBreakpoint();
  const compact = !(screens.md ?? false);
  const [form] = Form.useForm<TeamFormValues>();
  const teamsQuery = useTeamsQuery();
  const createTeam = useCreateTeamMutation();
  const updateTeam = useUpdateTeamMutation();
  const deleteTeam = useDeleteTeamMutation();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TeamStatus>();
  const [editing, setEditing] = useState<Team | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState("");
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
    return items.filter((item) => {
      const matchesStatus = !status || item.status === status;
      const matchesKeyword =
        !keyword ||
        item.name.toLocaleLowerCase("zh-CN").includes(keyword) ||
        item.description?.toLocaleLowerCase("zh-CN").includes(keyword);
      return matchesStatus && Boolean(matchesKeyword);
    });
  }, [items, search, status]);

  const openCreate = () => {
    setEditing(null);
    setFormError("");
    form.setFieldsValue({ name: "", description: "", status: "active" });
    setFormOpen(true);
  };

  const openEdit = (team: Team) => {
    setEditing(team);
    setFormError("");
    form.setFieldsValue({
      name: team.name,
      description: team.description || "",
      status: team.status,
    });
    setFormOpen(true);
  };

  const saveTeam = async (values: TeamFormValues) => {
    const payload: SaveTeamPayload = {
      name: values.name.trim(),
      description: values.description?.trim() || null,
    };
    setFormError("");
    try {
      if (editing) {
        await updateTeam.mutateAsync({
          id: editing.id,
          payload: { ...payload, status: values.status },
        });
      } else {
        await createTeam.mutateAsync(payload);
      }
      form.resetFields();
      return true;
    } catch (reason) {
      setFormError(errorMessage(reason, "球队保存失败"));
      return false;
    }
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

  const columns: ProColumns<Team>[] = [
    {
      title: "球队",
      dataIndex: "name",
      render: (_, team) => (
        <div className="team-name-cell">
          <strong>{team.name}</strong>
          <Text type="secondary">ID {team.id}</Text>
          {compact ? (
            <Tag color={team.status === "active" ? "success" : "warning"}>
              {statusLabels[team.status]}
            </Tag>
          ) : null}
        </div>
      ),
    },
    ...(compact
      ? []
      : [
          {
            title: "简介",
            dataIndex: "description",
            ellipsis: true,
            renderText: (value: string | null) => value || "--",
          },
          {
            title: "队长",
            dataIndex: "captain_id",
            width: 160,
            render: (_: unknown, team: Team) =>
              team.captain ? (
                <Space size={8}>
                  <Avatar src={team.captain.avatar_url} size={28}>
                    {(
                      team.captain.real_name?.trim() ||
                      team.captain.nickname.trim() ||
                      String(team.captain.user_id)
                    ).slice(0, 1)}
                  </Avatar>
                  <span>
                    {team.captain.real_name?.trim() ||
                      team.captain.nickname.trim() ||
                      `用户 ${team.captain.user_id}`}
                  </span>
                </Space>
              ) : (
                "未指定"
              ),
          },
          {
            title: "状态",
            dataIndex: "status",
            width: 100,
            render: (_: unknown, team: Team) => (
              <Tag color={team.status === "active" ? "success" : "warning"}>
                {statusLabels[team.status]}
              </Tag>
            ),
          },
          {
            title: "更新时间",
            dataIndex: "updated_at",
            width: 180,
            renderText: formatDateTime,
          },
        ]),
    {
      title: "操作",
      key: "actions",
      valueType: "option",
      width: compact ? 144 : 176,
      fixed: "right",
      render: (_, team) => (
        <Space size={2}>
          <Tooltip title={compact ? undefined : "查看球队"}>
            <Button
              type="text"
              shape="circle"
              icon={<EyeOutlined />}
              aria-label={`查看${team.name}`}
              onClick={() => setDetailID(team.id)}
            />
          </Tooltip>
          <Tooltip title={compact ? undefined : "管理成员"}>
            <Button
              type="text"
              shape="circle"
              icon={<TeamOutlined />}
              aria-label={`管理${team.name}成员`}
              onClick={() => {
                setDetailID(null);
                setMemberTeam(team);
              }}
            />
          </Tooltip>
          <Tooltip title={compact ? undefined : "编辑球队"}>
            <Button
              type="text"
              shape="circle"
              icon={<EditOutlined />}
              aria-label={`编辑${team.name}`}
              onClick={() => openEdit(team)}
            />
          </Tooltip>
          <Popconfirm
            title={`永久删除“${team.name}”`}
            description="已用于比赛或申请的球队不能删除。"
            okText="永久删除"
            okButtonProps={{ danger: true }}
            cancelText="返回"
            onConfirm={() => removeTeam(team)}
          >
            <Tooltip title={compact ? undefined : "永久删除"}>
              <Button
                type="text"
                shape="circle"
                danger
                icon={<DeleteOutlined />}
                loading={deletingID === team.id}
                aria-label={`删除${team.name}`}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const listError = teamsQuery.error
    ? errorMessage(teamsQuery.error, "球队列表加载失败")
    : "";
  const visibleError = actionError || listError;
  const detail = detailQuery.data;

  return (
    <PageContainer
      title="球队管理"
      content={`共 ${items.length} 支球队`}
      extra={
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          创建球队
        </Button>
      }
    >
      <div className="list-toolbar">
        <Search
          allowClear
          placeholder="搜索球队名称或简介"
          className="team-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <Select<TeamStatus>
          allowClear
          placeholder="全部状态"
          className="status-filter"
          value={status}
          options={Object.entries(statusLabels).map(([value, label]) => ({
            value: value as TeamStatus,
            label,
          }))}
          onChange={setStatus}
        />
      </div>

      {visibleError ? (
        <Alert
          className="service-alert"
          type="error"
          showIcon
          closable
          message={visibleError}
          onClose={() => setActionError("")}
          action={
            teamsQuery.isError ? (
              <Button size="small" onClick={() => void teamsQuery.refetch()}>
                重新加载
              </Button>
            ) : null
          }
        />
      ) : null}

      <ProTable<Team>
        rowKey="id"
        search={false}
        options={false}
        cardProps={{ className: "team-table-panel" }}
        loading={teamsQuery.isFetching}
        dataSource={filteredItems}
        columns={columns}
        scroll={{ x: compact ? 620 : 900 }}
        pagination={{
          pageSize: 20,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 支`,
        }}
        onRow={(team) => ({ onDoubleClick: () => setDetailID(team.id) })}
      />

      <ModalForm<TeamFormValues>
        form={form}
        open={formOpen}
        title={editing ? "编辑球队" : "创建球队"}
        requiredMark={false}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setFormError("");
        }}
        submitter={{
          searchConfig: {
            submitText: editing ? "保存" : "创建",
            resetText: "取消",
          },
        }}
        modalProps={{ destroyOnHidden: true }}
        onFinish={saveTeam}
      >
        {formError ? (
          <Alert
            className="modal-alert"
            type="error"
            showIcon
            message={formError}
          />
        ) : null}
        <Form.Item
          name="name"
          label="球队名称"
          rules={[
            { required: true, whitespace: true, message: "请输入球队名称" },
            { max: 120, message: "球队名称不能超过 120 个字符" },
          ]}
        >
          <Input maxLength={120} />
        </Form.Item>
        <Form.Item name="description" label="球队简介">
          <Input.TextArea rows={4} maxLength={1000} showCount />
        </Form.Item>
        {editing ? (
          <Form.Item
            name="status"
            label="球队状态"
            rules={[{ required: true }]}
          >
            <Segmented
              block
              options={[
                { label: "启用", value: "active" },
                { label: "冻结", value: "frozen" },
              ]}
            />
          </Form.Item>
        ) : null}
      </ModalForm>

      <Drawer
        title="球队详情"
        size={compact ? "100%" : 460}
        open={Boolean(detailID)}
        loading={detailQuery.isFetching}
        extra={
          detail ? (
            <Button
              icon={<TeamOutlined />}
              onClick={() => {
                setDetailID(null);
                setMemberTeam(detail);
              }}
            >
              成员管理
            </Button>
          ) : null
        }
        onClose={() => setDetailID(null)}
      >
        {detailQuery.error ? (
          <Alert
            type="error"
            showIcon
            message={errorMessage(detailQuery.error, "球队详情加载失败")}
            action={
              <Button size="small" onClick={() => void detailQuery.refetch()}>
                重试
              </Button>
            }
          />
        ) : null}
        {detail ? (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="球队名称">
              {detail.name}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={detail.status === "active" ? "success" : "warning"}>
                {statusLabels[detail.status]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="球队简介">
              {detail.description || "--"}
            </Descriptions.Item>
            <Descriptions.Item label="队长">
              {detail.captain_id ? `用户 ${detail.captain_id}` : "未指定"}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {formatDateTime(detail.created_at)}
            </Descriptions.Item>
            <Descriptions.Item label="更新时间">
              {formatDateTime(detail.updated_at)}
            </Descriptions.Item>
          </Descriptions>
        ) : null}
      </Drawer>

      <TeamMemberManager
        open={Boolean(memberTeam)}
        team={memberTeam}
        onClose={() => setMemberTeam(null)}
        onTeamChange={setMemberTeam}
      />
    </PageContainer>
  );
}
