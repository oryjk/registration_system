import { PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import {
  Alert,
  Button,
  Drawer,
  Form,
  Grid,
  message,
  Space,
  Tooltip,
  Typography,
} from "antd";
import { useEffect, useMemo, useState } from "react";
import { useAdminCreditTeamFundMutation } from "../hooks/queries/useTeamFundQueries";
import {
  useAddTeamMemberMutation,
  useRemoveTeamMemberMutation,
  useSetTeamCaptainMutation,
  useTeamMemberCandidatesQuery,
  useTeamMembersQuery,
  useUpdatePlayerProfileMutation,
  useUpdateTeamMemberMutation,
} from "../hooks/queries/useTeamQueries";
import type { Team, TeamMember } from "../types/team";
import {
  type AddMemberFormValues,
  AddTeamMemberModal,
} from "./team-members/AddTeamMemberModal";
import {
  type CreditTeamFundFormValues,
  CreditTeamFundModal,
} from "./team-members/CreditTeamFundModal";
import {
  type EditMemberFormValues,
  EditTeamMemberModal,
} from "./team-members/EditTeamMemberModal";
import { TeamMemberTable } from "./team-members/TeamMemberTable";
import { displayMemberName } from "./team-members/team-member-display";

const { Text } = Typography;

interface TeamMemberManagerProps {
  open: boolean;
  team: Team | null;
  onClose: () => void;
  onTeamChange: (team: Team) => void;
}

function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

export function TeamMemberManager({
  open,
  team,
  onClose,
  onTeamChange,
}: TeamMemberManagerProps) {
  const screens = Grid.useBreakpoint();
  const compact = !(screens.md ?? false);
  const [addForm] = Form.useForm<AddMemberFormValues>();
  const [editForm] = Form.useForm<EditMemberFormValues>();
  const [creditForm] = Form.useForm<CreditTeamFundFormValues>();
  const [actionKey, setActionKey] = useState("");
  const [actionError, setActionError] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateError, setCandidateError] = useState("");
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [creditingMember, setCreditingMember] = useState<TeamMember | null>(
    null,
  );
  const teamID = team?.id || null;
  const membersQuery = useTeamMembersQuery(teamID, open);
  const candidatesQuery = useTeamMemberCandidatesQuery(
    teamID,
    candidateSearch,
    addOpen,
  );
  const addMember = useAddTeamMemberMutation();
  const updateMember = useUpdateTeamMemberMutation();
  const updateProfile = useUpdatePlayerProfileMutation(teamID);
  const removeMember = useRemoveTeamMemberMutation();
  const setCaptain = useSetTeamCaptainMutation();
  const creditTeamFund = useAdminCreditTeamFundMutation(teamID);
  const management = membersQuery.data;
  const members = management?.members || [];

  useEffect(() => {
    if (management?.team) onTeamChange(management.team);
  }, [management?.team, onTeamChange]);

  const openAdd = () => {
    addForm.setFieldsValue({ userID: undefined, role: "member" });
    setCandidateSearch("");
    setCandidateError("");
    setAddOpen(true);
  };

  const submitAdd = async () => {
    if (!teamID) return;
    let values: AddMemberFormValues;
    try {
      values = await addForm.validateFields();
    } catch {
      return;
    }
    setActionKey("add");
    setCandidateError("");
    let memberAdded = false;
    try {
      const result = await addMember.mutateAsync({
        teamID,
        payload: {
          user_id: values.userID,
          role: values.role === "captain" ? "member" : values.role,
        },
      });
      memberAdded = true;
      if (values.role === "captain") {
        const captainResult = await setCaptain.mutateAsync({
          teamID,
          userID: values.userID,
        });
        onTeamChange(captainResult.team);
      } else {
        onTeamChange(result.team);
      }
      setAddOpen(false);
      addForm.resetFields();
    } catch (reason) {
      const fallback = memberAdded
        ? "成员已添加，但设置队长失败，请在成员列表中重新设置队长"
        : "添加球队成员失败";
      setCandidateError(errorMessage(reason, fallback));
    } finally {
      setActionKey("");
    }
  };

  const openEdit = (member: TeamMember) => {
    if (member.role === "captain") return;
    editForm.setFieldsValue({
      realName: member.real_name ?? "",
      phoneNumber: member.phone_number ?? "",
      role: member.role,
      status: member.status,
    });
    setEditingMember(member);
    setActionError("");
  };

  const submitEdit = async () => {
    if (!teamID || !editingMember) return;
    let values: EditMemberFormValues;
    try {
      values = await editForm.validateFields();
    } catch {
      return;
    }
    setActionKey(`edit-${editingMember.user_id}`);
    setActionError("");
    let profileUpdated = false;
    try {
      await updateProfile.mutateAsync({
        userID: editingMember.user_id,
        payload: {
          real_name: values.realName.trim() || null,
          phone_number: values.phoneNumber.trim() || null,
        },
      });
      profileUpdated = true;
      const result = await updateMember.mutateAsync({
        teamID,
        userID: editingMember.user_id,
        payload: { role: values.role, status: values.status },
      });
      onTeamChange(result.team);
      setEditingMember(null);
      editForm.resetFields();
    } catch (reason) {
      const fallback = profileUpdated
        ? "球员资料已保存，但成员角色或状态更新失败"
        : "更新球员资料失败";
      setActionError(errorMessage(reason, fallback));
    } finally {
      setActionKey("");
    }
  };

  const openCredit = (member: TeamMember) => {
    creditForm.setFieldsValue({ amountYuan: undefined, note: "" });
    setCreditingMember(member);
    setActionError("");
  };

  const submitCredit = async () => {
    // actionKey 为同步防重入守卫：validateFields 的 await 窗口内快速双击
    // 会先于 confirmLoading 生效重入，导致重复充值。
    if (!teamID || !creditingMember || actionKey) return;
    let values: CreditTeamFundFormValues;
    try {
      values = await creditForm.validateFields();
    } catch {
      return;
    }
    setActionKey(`credit-${creditingMember.user_id}`);
    setActionError("");
    try {
      const result = await creditTeamFund.mutateAsync({
        team_id: teamID,
        user_id: creditingMember.user_id,
        amount_cents: Math.round(values.amountYuan * 100),
        note: values.note.trim() || undefined,
      });
      setCreditingMember(null);
      creditForm.resetFields();
      message.success(
        `已充值，新余额 ¥${(result.balance_cents / 100).toFixed(2)}`,
      );
    } catch (reason) {
      setActionError(errorMessage(reason, "队费充值失败"));
    } finally {
      setActionKey("");
    }
  };

  const changeCaptain = async (member: TeamMember, captain: boolean) => {
    if (!teamID) return;
    setActionKey(`captain-${member.user_id}`);
    setActionError("");
    try {
      const result = await setCaptain.mutateAsync({
        teamID,
        userID: captain ? member.user_id : null,
      });
      onTeamChange(result.team);
    } catch (reason) {
      setActionError(
        errorMessage(reason, captain ? "设置队长失败" : "取消队长失败"),
      );
    } finally {
      setActionKey("");
    }
  };

  const remove = async (member: TeamMember) => {
    if (!teamID) return;
    setActionKey(`remove-${member.user_id}`);
    setActionError("");
    try {
      const result = await removeMember.mutateAsync({
        teamID,
        userID: member.user_id,
      });
      onTeamChange(result.team);
    } catch (reason) {
      setActionError(errorMessage(reason, "移除球队成员失败"));
    } finally {
      setActionKey("");
    }
  };

  const activeCount = useMemo(
    () =>
      members.reduce(
        (total, member) => total + Number(member.status === "active"),
        0,
      ),
    [members],
  );
  const captain = useMemo(
    () => members.find((member) => member.role === "captain"),
    [members],
  );
  const membersError = membersQuery.error
    ? errorMessage(membersQuery.error, "球队成员加载失败")
    : "";
  const visibleError = actionError || membersError;
  const visibleCandidateError =
    candidateError ||
    (candidatesQuery.error
      ? errorMessage(candidatesQuery.error, "候选球员查询失败")
      : "");

  return (
    <>
      <Drawer
        title={team ? `${team.name} · 成员管理` : "成员管理"}
        size={compact ? "100%" : 780}
        open={open}
        onClose={onClose}
        extra={
          <Space size={4}>
            <Tooltip title="刷新成员">
              <Button
                shape="circle"
                type="text"
                icon={<ReloadOutlined />}
                aria-label="刷新成员"
                loading={membersQuery.isFetching}
                disabled={!teamID}
                onClick={() => void membersQuery.refetch()}
              />
            </Tooltip>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              disabled={!teamID}
              onClick={openAdd}
            >
              添加成员
            </Button>
          </Space>
        }
      >
        <div className="member-summary">
          <div>
            <Text type="secondary">成员总数</Text>
            <strong>{members.length}</strong>
          </div>
          <div>
            <Text type="secondary">启用成员</Text>
            <strong>{activeCount}</strong>
          </div>
          <div>
            <Text type="secondary">当前队长</Text>
            <strong>{captain ? displayMemberName(captain) : "未指定"}</strong>
          </div>
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
              membersQuery.isError ? (
                <Button
                  size="small"
                  onClick={() => void membersQuery.refetch()}
                >
                  重试
                </Button>
              ) : null
            }
          />
        ) : null}

        <TeamMemberTable
          members={members}
          loading={membersQuery.isFetching}
          compact={compact}
          actionKey={actionKey}
          onEdit={openEdit}
          onCredit={openCredit}
          onCaptainChange={(member, captain) =>
            void changeCaptain(member, captain)
          }
          onRemove={(member) => void remove(member)}
        />
      </Drawer>

      <AddTeamMemberModal
        open={addOpen}
        form={addForm}
        candidates={candidatesQuery.data || []}
        loadingCandidates={candidatesQuery.isFetching}
        submitting={actionKey === "add"}
        error={visibleCandidateError}
        hasCaptain={Boolean(captain)}
        onSearch={setCandidateSearch}
        onSubmit={() => void submitAdd()}
        onClose={() => setAddOpen(false)}
      />

      <EditTeamMemberModal
        member={editingMember}
        form={editForm}
        submitting={
          editingMember ? actionKey === `edit-${editingMember.user_id}` : false
        }
        error={editingMember ? actionError : ""}
        onSubmit={() => void submitEdit()}
        onClose={() => {
          setEditingMember(null);
          setActionError("");
        }}
      />

      <CreditTeamFundModal
        member={creditingMember}
        form={creditForm}
        submitting={
          creditingMember
            ? actionKey === `credit-${creditingMember.user_id}`
            : false
        }
        error={creditingMember ? actionError : ""}
        onSubmit={() => void submitCredit()}
        onClose={() => {
          setCreditingMember(null);
          setActionError("");
        }}
      />
    </>
  );
}
