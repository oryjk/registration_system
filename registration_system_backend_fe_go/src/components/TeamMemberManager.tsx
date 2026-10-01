import { Plus, RotateCw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { TeamFundTransactionItem } from "@/api/teamFund";
import { ErrorAlert } from "@/components/admin/error-alert";
import { Button } from "@/components/ui/button";
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
  useAdminConsumeTeamFundMutation,
  useAdminCreditTeamFundMutation,
  useAdminReverseTeamFundMutation,
  useMemberFundTransactionsQuery,
} from "@/hooks/queries/useTeamFundQueries";
import {
  useAddTeamMemberMutation,
  useRemoveTeamMemberMutation,
  useSetTeamCaptainMutation,
  useTeamMemberCandidatesQuery,
  useTeamMembersQuery,
  useUpdatePlayerProfileMutation,
  useUpdateTeamMemberMutation,
  useUpdateTeamMemberPaidMembershipMutation,
} from "@/hooks/queries/useTeamQueries";
import type { Team, TeamMember } from "@/types/team";
import { errorMessage } from "@/utils/error-message";
import {
  type AddMemberFormValues,
  AddTeamMemberModal,
} from "./team-members/AddTeamMemberModal";
import {
  type ConsumeTeamFundFormValues,
  ConsumeTeamFundModal,
} from "./team-members/ConsumeTeamFundModal";
import {
  type CreditTeamFundFormValues,
  CreditTeamFundModal,
} from "./team-members/CreditTeamFundModal";
import {
  type EditMemberFormValues,
  EditTeamMemberModal,
} from "./team-members/EditTeamMemberModal";
import { MemberFundTransactionsDialog } from "./team-members/MemberFundTransactionsDialog";
import { TeamMemberTable } from "./team-members/TeamMemberTable";
import { displayMemberName } from "./team-members/team-member-display";

interface TeamMemberManagerProps {
  open: boolean;
  team: Team | null;
  onClose: () => void;
  onTeamChange: (team: Team) => void;
}

export function TeamMemberManager({
  open,
  team,
  onClose,
  onTeamChange,
}: TeamMemberManagerProps) {
  const [actionKey, setActionKey] = useState("");
  const [actionError, setActionError] = useState("");
  const paidMembershipInFlight = useRef(false);
  const [addOpen, setAddOpen] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateError, setCandidateError] = useState("");
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [creditingMember, setCreditingMember] = useState<TeamMember | null>(
    null,
  );
  const [consumingMember, setConsumingMember] = useState<TeamMember | null>(
    null,
  );
  const [transactionsMember, setTransactionsMember] =
    useState<TeamMember | null>(null);
  const teamID = team?.id || null;
  const membersQuery = useTeamMembersQuery(teamID, open);
  const candidatesQuery = useTeamMemberCandidatesQuery(
    teamID,
    candidateSearch,
    addOpen,
  );
  const addMember = useAddTeamMemberMutation();
  const updateMember = useUpdateTeamMemberMutation();
  const updatePaidMembership = useUpdateTeamMemberPaidMembershipMutation();
  const updateProfile = useUpdatePlayerProfileMutation(teamID);
  const removeMember = useRemoveTeamMemberMutation();
  const setCaptain = useSetTeamCaptainMutation();
  const creditTeamFund = useAdminCreditTeamFundMutation(teamID);
  const consumeTeamFund = useAdminConsumeTeamFundMutation(teamID);
  const reverseTeamFund = useAdminReverseTeamFundMutation(teamID);
  const memberTransactions = useMemberFundTransactionsQuery(
    teamID,
    transactionsMember?.user_id ?? null,
    Boolean(transactionsMember),
  );
  const management = membersQuery.data;
  const members = management?.members || [];

  useEffect(() => {
    if (management?.team) onTeamChange(management.team);
  }, [management?.team, onTeamChange]);

  const openAdd = () => {
    setCandidateSearch("");
    setCandidateError("");
    setAddOpen(true);
  };

  const submitAdd = async (values: AddMemberFormValues) => {
    if (!teamID) return;
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
    setEditingMember(member);
    setActionError("");
  };

  const submitEdit = async (values: EditMemberFormValues) => {
    if (!teamID || !editingMember) return;
    // 保存目标在开始时固定：await 之后不得回读 editingMember，防止期间切换编辑对象。
    const member = editingMember;
    setActionKey(`edit-${member.user_id}`);
    setActionError("");
    let profileUpdated = false;
    try {
      await updateProfile.mutateAsync({
        userID: member.user_id,
        payload: {
          real_name: values.realName.trim() || null,
          phone_number: values.phoneNumber.trim() || null,
        },
      });
      profileUpdated = true;
      if (member.role !== "captain") {
        await updateMember.mutateAsync({
          teamID,
          userID: member.user_id,
          payload: { role: values.role, status: values.status },
        });
      }
      // 付费会员标记变更才提交；余额与充值时间由充值/消费/冲正动作维护，编辑资料不触碰财务。
      if (values.isPaidMember !== member.is_paid_member) {
        const result = await updatePaidMembership.mutateAsync({
          teamID,
          userID: member.user_id,
          payload: { is_paid_member: values.isPaidMember },
        });
        onTeamChange(result.team);
      }
      // 保存期间用户可能已切换到编辑其他成员，只关闭仍指向本次保存对象的弹窗。
      setEditingMember((current) =>
        current?.user_id === member.user_id ? null : current,
      );
    } catch (reason) {
      const fallback = profileUpdated
        ? "部分球员资料已保存，但成员或会员账户信息更新失败"
        : "更新球员资料失败";
      setActionError(errorMessage(reason, fallback));
    } finally {
      setActionKey("");
    }
  };

  const changePaidMembership = async (
    member: TeamMember,
    isPaidMember: boolean,
  ) => {
    if (!teamID || actionKey || paidMembershipInFlight.current) return;
    paidMembershipInFlight.current = true;
    setActionKey(`membership-${member.user_id}`);
    setActionError("");
    try {
      const result = await updatePaidMembership.mutateAsync({
        teamID,
        userID: member.user_id,
        payload: { is_paid_member: isPaidMember },
      });
      onTeamChange(result.team);
      toast.success(isPaidMember ? "已设为付费会员" : "已设为普通队员");
    } catch (reason) {
      setActionError(errorMessage(reason, "更新付费会员状态失败"));
    } finally {
      paidMembershipInFlight.current = false;
      setActionKey("");
    }
  };

  const openCredit = (member: TeamMember) => {
    setCreditingMember(member);
    setActionError("");
  };

  const submitCredit = async (values: CreditTeamFundFormValues) => {
    // actionKey 为同步防重入守卫：表单校验的 await 窗口内快速双击
    // 会先于按钮 disabled 生效重入，导致重复充值。
    if (!teamID || !creditingMember || actionKey) return;
    setActionKey(`credit-${creditingMember.user_id}`);
    setActionError("");
    try {
      const result = await creditTeamFund.mutateAsync({
        team_id: teamID,
        user_id: creditingMember.user_id,
        amount_cents: Math.round(values.amountYuan * 100),
        received_on: values.receivedOn,
        note: values.note.trim() || undefined,
        idempotency_key: values.idempotencyKey,
      });
      setCreditingMember(null);
      toast.success(
        `已充值，新余额 ¥${(result.balance_cents / 100).toFixed(2)}`,
      );
    } catch (reason) {
      setActionError(errorMessage(reason, "队费充值失败"));
    } finally {
      setActionKey("");
    }
  };

  const openConsume = (member: TeamMember) => {
    setConsumingMember(member);
    setActionError("");
  };

  const submitConsume = async (values: ConsumeTeamFundFormValues) => {
    if (!teamID || !consumingMember || actionKey) return;
    setActionKey(`consume-${consumingMember.user_id}`);
    setActionError("");
    try {
      const result = await consumeTeamFund.mutateAsync({
        team_id: teamID,
        user_id: consumingMember.user_id,
        amount_cents: Math.round(values.amountYuan * 100),
        note: values.reason.trim(),
        idempotency_key: values.idempotencyKey,
      });
      setConsumingMember(null);
      const balance = `¥${(result.balance_cents / 100).toFixed(2)}`;
      toast.success(
        result.balance_cents < 0
          ? `已扣费，当前欠款 ${balance}`
          : `已扣费，新余额 ${balance}`,
      );
    } catch (reason) {
      setActionError(errorMessage(reason, "消费扣费失败"));
    } finally {
      setActionKey("");
    }
  };

  const openTransactions = (member: TeamMember) => {
    setTransactionsMember(member);
    setActionError("");
  };

  const reverseTransaction = async (transaction: TeamFundTransactionItem) => {
    if (!teamID || !transactionsMember || actionKey) return;
    setActionKey(`reverse-${transactionsMember.user_id}`);
    setActionError("");
    try {
      const result = await reverseTeamFund.mutateAsync({
        team_id: teamID,
        user_id: transactionsMember.user_id,
        original_transaction_id: transaction.id,
        // 固定短备注：拼入原流水说明容易超过后端 120 字节（约 40 个汉字）上限。
        note: `冲正流水 #${transaction.id}`,
        idempotency_key: crypto.randomUUID(),
      });
      toast.success(
        `已冲正，新余额 ¥${(result.balance_cents / 100).toFixed(2)}`,
      );
    } catch (reason) {
      setActionError(errorMessage(reason, "冲正失败"));
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
      <Sheet onOpenChange={(next) => !next && onClose()} open={open}>
        <SheetContent className="member-manager-sheet" side="right">
          <SheetHeader>
            <div className="sheet-header-row">
              <div>
                <SheetTitle>
                  {team ? `${team.name} · 成员管理` : "成员管理"}
                </SheetTitle>
                <SheetDescription>管理球队成员、角色与队费。</SheetDescription>
              </div>
              <div className="toolbar">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      aria-label="刷新成员"
                      disabled={!teamID || membersQuery.isFetching}
                      onClick={() => void membersQuery.refetch()}
                      size="icon"
                      type="button"
                      variant="outline"
                    >
                      <RotateCw size={15} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>刷新成员</TooltipContent>
                </Tooltip>
                <Button disabled={!teamID} onClick={openAdd} type="button">
                  <Plus size={15} />
                  添加成员
                </Button>
              </div>
            </div>
          </SheetHeader>
          <div className="sheet-body">
            <div className="member-summary">
              <div>
                <span>成员总数</span>
                <strong>{members.length}</strong>
              </div>
              <div>
                <span>启用成员</span>
                <strong>{activeCount}</strong>
              </div>
              <div>
                <span>当前队长</span>
                <strong>
                  {captain ? displayMemberName(captain) : "未指定"}
                </strong>
              </div>
            </div>

            {visibleError ? (
              <ErrorAlert
                message={visibleError}
                onRetry={
                  membersQuery.isError
                    ? () => void membersQuery.refetch()
                    : undefined
                }
              />
            ) : null}

            <div className="member-table-panel">
              <TeamMemberTable
                actionKey={actionKey}
                key={teamID}
                loading={membersQuery.isFetching}
                members={members}
                onCaptainChange={(member, captain) =>
                  void changeCaptain(member, captain)
                }
                onConsume={openConsume}
                onCredit={openCredit}
                onEdit={openEdit}
                onPaidMembershipChange={(member, isPaidMember) =>
                  void changePaidMembership(member, isPaidMember)
                }
                onRemove={(member) => void remove(member)}
                onTransactions={openTransactions}
              />
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AddTeamMemberModal
        candidates={candidatesQuery.data || []}
        error={visibleCandidateError}
        hasCaptain={Boolean(captain)}
        loadingCandidates={candidatesQuery.isFetching}
        onClose={() => setAddOpen(false)}
        onSearch={setCandidateSearch}
        onSubmit={(values) => void submitAdd(values)}
        open={addOpen}
        submitting={actionKey === "add"}
      />

      <EditTeamMemberModal
        error={editingMember ? actionError : ""}
        member={editingMember}
        onClose={() => {
          setEditingMember(null);
          setActionError("");
        }}
        onSubmit={(values) => void submitEdit(values)}
        submitting={
          editingMember ? actionKey === `edit-${editingMember.user_id}` : false
        }
      />

      <CreditTeamFundModal
        error={creditingMember ? actionError : ""}
        member={creditingMember}
        onClose={() => {
          setCreditingMember(null);
          setActionError("");
        }}
        onSubmit={(values) => void submitCredit(values)}
        submitting={
          creditingMember
            ? actionKey === `credit-${creditingMember.user_id}`
            : false
        }
      />

      <ConsumeTeamFundModal
        error={consumingMember ? actionError : ""}
        member={consumingMember}
        onClose={() => {
          setConsumingMember(null);
          setActionError("");
        }}
        onSubmit={(values) => void submitConsume(values)}
        submitting={
          consumingMember
            ? actionKey === `consume-${consumingMember.user_id}`
            : false
        }
      />

      <MemberFundTransactionsDialog
        error={transactionsMember ? actionError : ""}
        loading={memberTransactions.isLoading}
        member={transactionsMember}
        onClose={() => {
          setTransactionsMember(null);
          setActionError("");
        }}
        onReverse={(transaction) => void reverseTransaction(transaction)}
        reversing={
          transactionsMember
            ? actionKey === `reverse-${transactionsMember.user_id}`
            : false
        }
        transactions={memberTransactions.data || []}
      />
    </>
  );
}
