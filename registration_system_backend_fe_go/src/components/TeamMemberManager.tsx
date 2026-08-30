import { Plus, RotateCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
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
import { useAdminCreditTeamFundMutation } from "@/hooks/queries/useTeamFundQueries";
import {
  useAddTeamMemberMutation,
  useRemoveTeamMemberMutation,
  useSetTeamCaptainMutation,
  useTeamMemberCandidatesQuery,
  useTeamMembersQuery,
  useUpdatePlayerProfileMutation,
  useUpdateTeamMemberMutation,
} from "@/hooks/queries/useTeamQueries";
import type { Team, TeamMember } from "@/types/team";
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
    if (member.role === "captain") return;
    setEditingMember(member);
    setActionError("");
  };

  const submitEdit = async (values: EditMemberFormValues) => {
    if (!teamID || !editingMember) return;
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
        note: values.note.trim() || undefined,
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

            <TeamMemberTable
              actionKey={actionKey}
              loading={membersQuery.isFetching}
              members={members}
              onCaptainChange={(member, captain) =>
                void changeCaptain(member, captain)
              }
              onCredit={openCredit}
              onEdit={openEdit}
              onRemove={(member) => void remove(member)}
            />
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
    </>
  );
}
