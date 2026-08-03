import DeleteOutlined from "@ant-design/icons/es/icons/DeleteOutlined";
import EditOutlined from "@ant-design/icons/es/icons/EditOutlined";
import EyeOutlined from "@ant-design/icons/es/icons/EyeOutlined";
import PlusOutlined from "@ant-design/icons/es/icons/PlusOutlined";
import SearchOutlined from "@ant-design/icons/es/icons/SearchOutlined";
import TeamOutlined from "@ant-design/icons/es/icons/TeamOutlined";
import Alert from "antd/es/alert";
import Button from "antd/es/button";
import Descriptions from "antd/es/descriptions";
import Drawer from "antd/es/drawer";
import Form from "antd/es/form";
import Grid from "antd/es/grid";
import Input from "antd/es/input";
import Modal from "antd/es/modal";
import Popconfirm from "antd/es/popconfirm";
import Segmented from "antd/es/segmented";
import Select from "antd/es/select";
import Space from "antd/es/space";
import Table from "antd/es/table";
import Tag from "antd/es/tag";
import Tooltip from "antd/es/tooltip";
import Typography from "antd/es/typography";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createTeam,
  deleteTeam,
  getTeam,
  listTeams,
  updateTeam,
} from "../api/teams";
import { TeamMemberManager } from "../components/TeamMemberManager";
import type { SaveTeamPayload, Team, TeamStatus } from "../types/team";

const { Text, Title } = Typography;

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

export default function TeamListPage() {
  const screens = Grid.useBreakpoint();
  const compact = !(screens.md ?? false);
  const [form] = Form.useForm<TeamFormValues>();
  const [items, setItems] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TeamStatus | undefined>();
  const [editing, setEditing] = useState<Team | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalError, setModalError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState<Team | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [deletingID, setDeletingID] = useState<number | null>(null);
  const [memberTeam, setMemberTeam] = useState<Team | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(sortTeams(await listTeams()));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "球队列表加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
    setModalError("");
    form.setFieldsValue({ name: "", description: "", status: "active" });
    setModalOpen(true);
  };

  const openEdit = (team: Team) => {
    setEditing(team);
    setModalError("");
    form.setFieldsValue({
      name: team.name,
      description: team.description || "",
      status: team.status,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (submitting) return;
    setModalOpen(false);
    setModalError("");
  };

  const submit = async () => {
    let values: TeamFormValues;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }
    const payload: SaveTeamPayload = {
      name: values.name.trim(),
      description: values.description?.trim() || null,
    };
    setSubmitting(true);
    setModalError("");
    try {
      const saved = editing
        ? await updateTeam(editing.id, { ...payload, status: values.status })
        : await createTeam(payload);
      setItems((current) =>
        sortTeams(
          editing
            ? current.map((item) => (item.id === saved.id ? saved : item))
            : [...current, saved],
        ),
      );
      if (detail?.id === saved.id) setDetail(saved);
      setModalOpen(false);
      form.resetFields();
    } catch (reason) {
      setModalError(reason instanceof Error ? reason.message : "球队保存失败");
    } finally {
      setSubmitting(false);
    }
  };

  const openDetail = async (team: Team) => {
    setDetail(team);
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      setDetail(await getTeam(team.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "球队详情加载失败");
    } finally {
      setDetailLoading(false);
    }
  };

  const remove = async (team: Team) => {
    setDeletingID(team.id);
    setError("");
    try {
      await deleteTeam(team.id);
      setItems((current) => current.filter((item) => item.id !== team.id));
      if (detail?.id === team.id) {
        setDetailOpen(false);
        setDetail(null);
      }
      if (memberTeam?.id === team.id) setMemberTeam(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "球队删除失败");
    } finally {
      setDeletingID(null);
    }
  };

  const openMembers = (team: Team) => {
    setDetailOpen(false);
    setMemberTeam(team);
  };

  const handleMemberTeamChange = useCallback((updated: Team) => {
    setItems((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
    setDetail((current) => (current?.id === updated.id ? updated : current));
    setMemberTeam(updated);
  }, []);

  const columns = [
    {
      title: "球队",
      dataIndex: "name",
      render: (_: string, team: Team) => (
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
            render: (value: string | null) => (
              <Text
                className="team-description"
                ellipsis={{ tooltip: value || undefined }}
              >
                {value || "--"}
              </Text>
            ),
          },
          {
            title: "队长",
            dataIndex: "captain_id",
            width: 110,
            render: (value: number | null) =>
              value ? `用户 ${value}` : "未指定",
          },
        ]),
    ...(compact
      ? []
      : [
          {
            title: "状态",
            dataIndex: "status",
            width: 100,
            render: (value: TeamStatus) => (
              <Tag color={value === "active" ? "success" : "warning"}>
                {statusLabels[value]}
              </Tag>
            ),
          },
        ]),
    ...(compact
      ? []
      : [
          {
            title: "更新时间",
            dataIndex: "updated_at",
            width: 180,
            render: formatDateTime,
          },
        ]),
    {
      title: "",
      key: "actions",
      width: compact ? 144 : 176,
      fixed: compact ? undefined : ("right" as const),
      render: (_: unknown, team: Team) => (
        <Space size={2}>
          <Tooltip title={compact ? undefined : "查看球队"}>
            <Button
              type="text"
              shape="circle"
              icon={<EyeOutlined />}
              aria-label={`查看${team.name}`}
              onClick={() => void openDetail(team)}
            />
          </Tooltip>
          <Tooltip title={compact ? undefined : "管理成员"}>
            <Button
              type="text"
              shape="circle"
              icon={<TeamOutlined />}
              aria-label={`管理${team.name}成员`}
              onClick={() => openMembers(team)}
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
            onConfirm={() => void remove(team)}
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

  return (
    <main className="team-list-page">
      <section className="page-heading">
        <div>
          <Text className="page-kicker">TEAM DIRECTORY</Text>
          <Title level={2}>球队管理</Title>
          <Text type="secondary">共 {items.length} 支球队</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          创建球队
        </Button>
      </section>

      <section className="list-toolbar">
        <Input
          allowClear
          prefix={<SearchOutlined />}
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
      </section>

      {error ? (
        <Alert
          className="service-alert"
          type="error"
          showIcon
          message={error}
          closable
          onClose={() => setError("")}
          action={
            <Button size="small" onClick={() => void load()}>
              重新加载
            </Button>
          }
        />
      ) : null}

      <section className="table-panel team-table-panel">
        <Table<Team>
          rowKey="id"
          loading={loading}
          dataSource={filteredItems}
          columns={columns}
          scroll={compact ? undefined : { x: 900 }}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `共 ${total} 支`,
          }}
          onRow={(team) => ({ onDoubleClick: () => void openDetail(team) })}
        />
      </section>

      <Modal
        open={modalOpen}
        title={editing ? "编辑球队" : "创建球队"}
        okText={editing ? "保存" : "创建"}
        cancelText="取消"
        confirmLoading={submitting}
        onOk={() => void submit()}
        onCancel={closeModal}
        destroyOnHidden
      >
        {modalError ? (
          <Alert
            className="modal-alert"
            type="error"
            showIcon
            message={modalError}
          />
        ) : null}
        <Form<TeamFormValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          disabled={submitting}
        >
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
        </Form>
      </Modal>

      <Drawer
        title="球队详情"
        width={compact ? 360 : 460}
        open={detailOpen}
        loading={detailLoading}
        extra={
          detail ? (
            <Button icon={<TeamOutlined />} onClick={() => openMembers(detail)}>
              成员管理
            </Button>
          ) : null
        }
        onClose={() => setDetailOpen(false)}
      >
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
        onTeamChange={handleMemberTeamChange}
      />
    </main>
  );
}
