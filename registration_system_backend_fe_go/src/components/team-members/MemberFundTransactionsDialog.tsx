import { useMemo, useState } from "react";
import type { TeamFundTransactionItem } from "@/api/teamFund";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminsQuery } from "@/hooks/queries/useAdminQueries";
import type { TeamMember } from "@/types/team";
import { formatCompactDateTime, formatYuanAmount } from "@/utils/format";
import { displayMemberName } from "./team-member-display";

const sourceLabels: Record<string, string> = {
  membership_payment: "微信充值",
  admin_credit: "人工充值",
  manual_consume: "消费扣费",
  manual_reversal: "冲正",
  manual_adjustment: "历史调整",
  match_settlement: "比赛结算",
  settlement_reversal: "结算回加",
};

/** 可人工冲正的流水来源：微信支付与比赛结算走各自的重算流程。 */
const manuallyReversibleSources = new Set([
  "admin_credit",
  "manual_consume",
  "manual_adjustment",
]);

interface MemberFundTransactionsDialogProps {
  member: TeamMember | null;
  transactions: TeamFundTransactionItem[];
  loading: boolean;
  error: string;
  reversing: boolean;
  onReverse: (transaction: TeamFundTransactionItem) => void;
  onClose: () => void;
}

/** 成员队费流水：人工流水可发起冲正（反向记账，不删除历史）。 */
export function MemberFundTransactionsDialog({
  member,
  transactions,
  loading,
  error,
  reversing,
  onReverse,
  onClose,
}: MemberFundTransactionsDialogProps) {
  const [reversingID, setReversingID] = useState<number | null>(null);
  // 操作人身份以流水记录为准：管理员名称查不到（已下线/查询失败）时回退显示编号。
  const adminsQuery = useAdminsQuery(Boolean(member));
  const adminNames = useMemo(() => {
    const names = new Map<number, string>();
    for (const admin of adminsQuery.data || []) {
      names.set(admin.id, admin.username);
    }
    return names;
  }, [adminsQuery.data]);

  const operatorLabel = (transaction: TeamFundTransactionItem): string => {
    if (transaction.created_by_admin_id != null) {
      const name = adminNames.get(transaction.created_by_admin_id);
      return name
        ? `后台管理员 ${name}`
        : `后台管理员 #${transaction.created_by_admin_id}`;
    }
    if (transaction.created_by_user_id != null) {
      return `用户 #${transaction.created_by_user_id}`;
    }
    return "操作人未记录";
  };

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      open={Boolean(member)}
    >
      <DialogContent className="dialog-wide">
        <DialogHeader>
          <DialogTitle>
            队费流水 · {member ? displayMemberName(member) : ""}
          </DialogTitle>
          <DialogDescription>
            人工记账的流水可冲正更正：反向记一笔并关联原流水，历史不删除。
          </DialogDescription>
        </DialogHeader>
        {error ? <p className="cell-secondary">{error}</p> : null}
        {loading ? (
          <p className="cell-secondary">正在加载流水…</p>
        ) : transactions.length === 0 ? (
          <p className="cell-secondary">暂无队费流水。</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>录入时间</TableHead>
                <TableHead>收款日期</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>金额</TableHead>
                <TableHead>余额</TableHead>
                <TableHead>操作人</TableHead>
                <TableHead>说明</TableHead>
                <TableHead className="table-head-actions">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => {
                const reversible =
                  manuallyReversibleSources.has(transaction.source) &&
                  !transaction.reversed_by_transaction_id;
                return (
                  <TableRow key={transaction.id}>
                    <TableCell className="cell-secondary">
                      {formatCompactDateTime(transaction.created_at)}
                    </TableCell>
                    <TableCell className="cell-secondary">
                      {transaction.received_on ?? "—"}
                    </TableCell>
                    <TableCell>
                      {sourceLabels[transaction.source] ?? transaction.source}
                      {transaction.reversed_by_transaction_id
                        ? "（已冲正）"
                        : ""}
                    </TableCell>
                    <TableCell>
                      <span
                        className={
                          transaction.amount_cents < 0
                            ? "amount-negative"
                            : "amount-positive"
                        }
                      >
                        {transaction.amount_cents < 0 ? "−" : "+"}
                        {formatYuanAmount(Math.abs(transaction.amount_cents))}
                      </span>
                    </TableCell>
                    <TableCell
                      className={
                        transaction.balance_after_cents < 0
                          ? "amount-negative"
                          : undefined
                      }
                    >
                      {formatYuanAmount(transaction.balance_after_cents)}
                    </TableCell>
                    <TableCell className="cell-secondary">
                      {operatorLabel(transaction)}
                    </TableCell>
                    <TableCell className="cell-secondary">
                      {transaction.description}
                    </TableCell>
                    <TableCell className="table-head-actions">
                      {reversible ? (
                        <Button
                          disabled={reversing}
                          onClick={() => {
                            setReversingID(transaction.id);
                            onReverse(transaction);
                          }}
                          size="sm"
                          variant="outline"
                        >
                          {reversing && reversingID === transaction.id
                            ? "冲正中…"
                            : "冲正"}
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
}
