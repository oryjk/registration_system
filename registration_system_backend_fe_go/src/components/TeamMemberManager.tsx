import CrownOutlined from "@ant-design/icons/es/icons/CrownOutlined";
import DeleteOutlined from "@ant-design/icons/es/icons/DeleteOutlined";
import EditOutlined from "@ant-design/icons/es/icons/EditOutlined";
import PlusOutlined from "@ant-design/icons/es/icons/PlusOutlined";
import ReloadOutlined from "@ant-design/icons/es/icons/ReloadOutlined";
import Alert from "antd/es/alert";
import Avatar from "antd/es/avatar";
import Button from "antd/es/button";
import Drawer from "antd/es/drawer";
import Empty from "antd/es/empty";
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addTeamMember,
  listTeamMemberCandidates,
  listTeamMembers,
  removeTeamMember,
  setTeamCaptain,
  updateTeamMember,
} from "../api/teams";
import type {
  AssignableTeamMemberRole,
  Team,
  TeamMember,
  TeamMemberCandidate,
  TeamMemberManagement,
  TeamMemberRole,
  TeamMemberStatus,
} from "../types/team";

const { Text } = Typography;

const assignableRoleOptions: { label: string; value: AssignableTeamMemberRole }[] = [
  { label: "领队", value: "leader" },
  { label: "副队长", value: "vice_captain" },
  { label: "队员", value: "member" },
];

const roleLabels: Record<TeamMemberRole, string> = {
  captain: "队长",
  leader: "领队",
  vice_captain: "副队长",
  member: "队员",
};

const roleColors: Record<TeamMemberRole, string> = {
  captain: "gold",
  leader: "blue",
  vice_captain: "cyan",
  member: "default",
};

const statusLabels: Record<TeamMemberStatus, string> = {
  active: "已启用",
  inactive: "已冻结",
};

interface AddMemberFormValues {
  userID: number;
  role: AssignableTeamMemberRole;
}

interface EditMemberFormValues {
  role: AssignableTeamMemberRole;
  status: TeamMemberStatus;
}

interface TeamMemberManagerProps {
  open: boolean;
  team: Team | null;
  onClose: () => void;
  onTeamChange: (team: Team) => void;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium" }).format(new Date(value));
}

function displayName(member: Pick<TeamMember, "nickname" | "user_id">) {
  return member.nickname.trim() || `用户 ${member.user_id}`;
}

function memberInitial(member: Pick<TeamMember, "nickname" | "user_id">) {
  return member.nickname.trim().slice(0, 1) || String(member.user_id).slice(-1);
}

function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

export function TeamMemberManager({ open, team, onClose, onTeamChange }: TeamMemberManagerProps) {
  const screens = Grid.useBreakpoint();
  const compact = !(screens.md ?? false);
  const [addForm] = Form.useForm<AddMemberFormValues>();
  const [editForm] = Form.useForm<EditMemberFormValues>();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [candidates, setCandidates] = useState<TeamMemberCandidate[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [candidateError, setCandidateError] = useState("");
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const candidateRequestID = useRef(0);
  const teamID = team?.id;

  const applyResult = useCallback((result: TeamMemberManagement) => {
    setMembers(result.members);
    onTeamChange(result.team);
  }, [onTeamChange]);

  const loadMembers = useCallback(async (id: number) => {
    setLoading(true);
    setError("");
    try {
      applyResult(await listTeamMembers(id));
    } catch (reason) {
      setError(errorMessage(reason, "球队成员加载失败"));
    } finally {
      setLoading(false);
    }
  }, [applyResult]);

  useEffect(() => {
    if (!open || !teamID) return;
    void loadMembers(teamID);
  }, [loadMembers, open, teamID]);

  const loadCandidates = async (search = "") => {
    if (!teamID) return;
    const requestID = ++candidateRequestID.current;
    setCandidatesLoading(true);
    setCandidateError("");
    try {
      const result = await listTeamMemberCandidates(teamID, search);
      if (candidateRequestID.current === requestID) setCandidates(result);
    } catch (reason) {
      if (candidateRequestID.current === requestID) {
        setCandidateError(errorMessage(reason, "候选球员查询失败"));
      }
    } finally {
      if (candidateRequestID.current === requestID) setCandidatesLoading(false);
    }
  };

  const openAdd = () => {
    addForm.setFieldsValue({ userID: undefined, role: "member" });
    setCandidates([]);
    setCandidateError("");
    setAddOpen(true);
    void loadCandidates();
  };

  const submitAdd = async () => {
    if (!teamID) return;
    let values: AddMemberFormValues;
    try {
      values = await addForm.validateFields();
    } catch {
      return;
    }
    setActionLoading("add");
    setCandidateError("");
    try {
      applyResult(await addTeamMember(teamID, { user_id: values.userID, role: values.role }));
      setAddOpen(false);
      addForm.resetFields();
    } catch (reason) {
      setCandidateError(errorMessage(reason, "添加球队成员失败"));
    } finally {
      setActionLoading("");
    }
  };

  const openEdit = (member: TeamMember) => {
    if (member.role === "captain") return;
    editForm.setFieldsValue({ role: member.role, status: member.status });
    setEditingMember(member);
    setError("");
  };

  const submitEdit = async () => {
    if (!teamID || !editingMember) return;
    let values: EditMemberFormValues;
    try {
      values = await editForm.validateFields();
    } catch {
      return;
    }
    setActionLoading(`edit-${editingMember.user_id}`);
    setError("");
    try {
      applyResult(await updateTeamMember(teamID, editingMember.user_id, values));
      setEditingMember(null);
      editForm.resetFields();
    } catch (reason) {
      setError(errorMessage(reason, "更新球队成员失败"));
    } finally {
      setActionLoading("");
    }
  };

  const changeCaptain = async (member: TeamMember, captain: boolean) => {
    if (!teamID) return;
    setActionLoading(`captain-${member.user_id}`);
    setError("");
    try {
      applyResult(await setTeamCaptain(teamID, captain ? member.user_id : null));
    } catch (reason) {
      setError(errorMessage(reason, captain ? "设置队长失败" : "取消队长失败"));
    } finally {
      setActionLoading("");
    }
  };

  const remove = async (member: TeamMember) => {
    if (!teamID) return;
    setActionLoading(`remove-${member.user_id}`);
    setError("");
    try {
      applyResult(await removeTeamMember(teamID, member.user_id));
    } catch (reason) {
      setError(errorMessage(reason, "移除球队成员失败"));
    } finally {
      setActionLoading("");
    }
  };

  const activeCount = useMemo(() => members.reduce((total, member) => total + Number(member.status === "active"), 0), [members]);
  const captain = useMemo(() => members.find((member) => member.role === "captain"), [members]);

  const columns = [
    {
      title: "成员",
      key: "member",
      render: (_: unknown, member: TeamMember) => (
        <div className="member-identity">
          <Avatar src={member.avatar_url} size={36}>{memberInitial(member)}</Avatar>
          <div>
            <strong>{displayName(member)}</strong>
            <Text type="secondary">用户 ID {member.user_id}</Text>
            {compact ? (
              <Space size={4} wrap>
                <Tag color={roleColors[member.role]}>{roleLabels[member.role]}</Tag>
                <Tag color={member.status === "active" ? "success" : "warning"}>{statusLabels[member.status]}</Tag>
              </Space>
            ) : null}
          </div>
        </div>
      ),
    },
    ...(compact ? [] : [{
      title: "角色",
      dataIndex: "role",
      width: 100,
      render: (role: TeamMemberRole) => <Tag color={roleColors[role]}>{roleLabels[role]}</Tag>,
    }]),
    ...(compact ? [] : [{
      title: "状态",
      dataIndex: "status",
      width: 100,
      render: (status: TeamMemberStatus) => <Tag color={status === "active" ? "success" : "warning"}>{statusLabels[status]}</Tag>,
    }]),
    ...(compact ? [] : [{ title: "加入时间", dataIndex: "joined_at", width: 126, render: formatDate }]),
    {
      title: "",
      key: "actions",
      width: compact ? 124 : 138,
      fixed: compact ? undefined : "right" as const,
      render: (_: unknown, member: TeamMember) => {
        const isCaptain = member.role === "captain";
        const memberName = displayName(member);
        const captainTitle = isCaptain ? "取消队长" : member.status === "active" ? "设为队长" : "冻结成员不能设为队长";
        return (
          <Space size={0}>
            <Popconfirm
              title={isCaptain ? `取消${memberName}的队长身份` : `将${memberName}设为队长`}
              description={isCaptain ? "取消后该成员将恢复为普通队员。" : "原队长将自动恢复为普通队员。"}
              okText="确认"
              cancelText="返回"
              disabled={!isCaptain && member.status !== "active"}
              onConfirm={() => void changeCaptain(member, !isCaptain)}
            >
              <Tooltip title={compact ? undefined : captainTitle}>
                <Button
                  type="text"
                  shape="circle"
                  disabled={!isCaptain && member.status !== "active"}
                  loading={actionLoading === `captain-${member.user_id}`}
                  icon={<CrownOutlined />}
                  aria-label={`${isCaptain ? "取消" : "设置"}${memberName}为队长`}
                />
              </Tooltip>
            </Popconfirm>
            <Tooltip title={compact ? undefined : isCaptain ? "请先取消或更换队长" : "编辑成员"}>
              <Button
                type="text"
                shape="circle"
                disabled={isCaptain}
                loading={actionLoading === `edit-${member.user_id}`}
                icon={<EditOutlined />}
                aria-label={`编辑${memberName}`}
                onClick={() => openEdit(member)}
              />
            </Tooltip>
            <Popconfirm
              title={`移除${memberName}`}
              description="移除后可通过候选球员重新添加。"
              okText="移除"
              okButtonProps={{ danger: true }}
              cancelText="返回"
              disabled={isCaptain}
              onConfirm={() => void remove(member)}
            >
              <Button
                type="text"
                shape="circle"
                danger
                disabled={isCaptain}
                loading={actionLoading === `remove-${member.user_id}`}
                icon={<DeleteOutlined />}
                aria-label={`移除${memberName}`}
              />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <Drawer
        title={team ? `${team.name} · 成员管理` : "成员管理"}
        width={compact ? "100%" : 780}
        open={open}
        onClose={onClose}
        extra={(
          <Space size={4}>
            <Tooltip title="刷新成员">
              <Button shape="circle" type="text" icon={<ReloadOutlined />} aria-label="刷新成员" loading={loading} disabled={!teamID} onClick={() => teamID && void loadMembers(teamID)} />
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} disabled={!teamID} onClick={openAdd}>添加成员</Button>
          </Space>
        )}
      >
        <div className="member-summary">
          <div><Text type="secondary">成员总数</Text><strong>{members.length}</strong></div>
          <div><Text type="secondary">启用成员</Text><strong>{activeCount}</strong></div>
          <div><Text type="secondary">当前队长</Text><strong>{captain ? displayName(captain) : "未指定"}</strong></div>
        </div>

        {error ? <Alert className="service-alert" type="error" showIcon closable message={error} onClose={() => setError("")} /> : null}

        <Table<TeamMember>
          className="member-table"
          rowKey="id"
          loading={loading}
          dataSource={members}
          columns={columns}
          pagination={members.length > 20 ? { pageSize: 20, showSizeChanger: false } : false}
          scroll={compact ? undefined : { x: 680 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无球队成员" /> }}
        />
      </Drawer>

      <Modal
        title="添加球队成员"
        open={addOpen}
        okText="添加"
        cancelText="取消"
        confirmLoading={actionLoading === "add"}
        onOk={() => void submitAdd()}
        onCancel={() => setAddOpen(false)}
        destroyOnHidden
      >
        {candidateError ? <Alert className="modal-alert" type="error" showIcon message={candidateError} /> : null}
        <Form<AddMemberFormValues> form={addForm} layout="vertical" requiredMark={false} disabled={actionLoading === "add"}>
          <Form.Item label="查询球员">
            <Input.Search allowClear enterButton="查询" placeholder="输入昵称或用户 ID" loading={candidatesLoading} onSearch={(value) => void loadCandidates(value)} />
          </Form.Item>
          <Form.Item name="userID" label="选择球员" rules={[{ required: true, message: "请选择需要添加的球员" }]}>
            <Select
              showSearch
              optionFilterProp="label"
              loading={candidatesLoading}
              placeholder={candidatesLoading ? "正在加载候选球员" : "请选择球员"}
              notFoundContent={candidatesLoading ? null : "没有可添加的球员"}
              options={candidates.map((candidate) => ({
                value: candidate.user_id,
                label: `${candidate.nickname.trim() || "未设置昵称"} · ID ${candidate.user_id}`,
              }))}
            />
          </Form.Item>
          <Form.Item name="role" label="成员角色" rules={[{ required: true }]}>
            <Select options={assignableRoleOptions} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={editingMember ? `编辑${displayName(editingMember)}` : "编辑成员"}
        open={Boolean(editingMember)}
        okText="保存"
        cancelText="取消"
        confirmLoading={editingMember ? actionLoading === `edit-${editingMember.user_id}` : false}
        onOk={() => void submitEdit()}
        onCancel={() => setEditingMember(null)}
        destroyOnHidden
      >
        <Form<EditMemberFormValues> form={editForm} layout="vertical" requiredMark={false}>
          <Form.Item name="role" label="成员角色" rules={[{ required: true }]}>
            <Select options={assignableRoleOptions} />
          </Form.Item>
          <Form.Item name="status" label="成员状态" rules={[{ required: true }]}>
            <Segmented block options={[{ label: "启用", value: "active" }, { label: "冻结", value: "inactive" }]} />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}
