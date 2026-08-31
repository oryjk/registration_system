import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ErrorAlert } from "@/components/admin/error-alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { TeamMember } from "@/types/team";
import { formatYuan, formatYuanAmount } from "@/utils/format";
import { displayMemberName } from "./team-member-display";

export interface CreditTeamFundFormValues {
  amountYuan: number;
  note: string;
}

/** 单笔手动充值上限（元），与后端 teamfund.AdminCreditService 的上限保持一致。 */
export const MAX_CREDIT_YUAN = 10000;

const creditSchema = z.object({
  amountYuan: z
    .number({ invalid_type_error: "请输入充值金额" })
    .positive({ message: "充值金额需要大于 0" })
    .max(MAX_CREDIT_YUAN, {
      // MAX_CREDIT_YUAN 单位为元，formatYuan 接受分，故乘 100 对齐。
      message: `单笔手动充值不能超过 ${formatYuan(MAX_CREDIT_YUAN * 100)}，更大金额请拆分多笔`,
    }),
  note: z.string().max(120, { message: "备注不能超过 120 个字符" }),
});

interface CreditTeamFundModalProps {
  member: TeamMember | null;
  submitting: boolean;
  error: string;
  onSubmit: (values: CreditTeamFundFormValues) => void;
  onClose: () => void;
}

export function CreditTeamFundModal({
  member,
  submitting,
  error,
  onSubmit,
  onClose,
}: CreditTeamFundModalProps) {
  const form = useForm<z.infer<typeof creditSchema>>({
    defaultValues: { amountYuan: undefined, note: "" },
    resolver: zodResolver(creditSchema),
  });

  useEffect(() => {
    if (!member) return;
    form.reset({ amountYuan: undefined, note: "" });
  }, [member, form]);

  const submit = form.handleSubmit((values) =>
    onSubmit({ amountYuan: values.amountYuan, note: values.note }),
  );

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      open={Boolean(member)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {member ? `队费充值 · ${displayMemberName(member)}` : "队费充值"}
          </DialogTitle>
          <DialogDescription>
            充值金额会直接追加到该成员的队费余额。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="dialog-form" onSubmit={submit}>
            {error ? <ErrorAlert message={error} /> : null}
            {member ? (
              <p className="credit-current-balance">
                当前队费余额：
                {member.balance_cents < 0 ? (
                  <strong className="credit-balance-debt">
                    欠款 ¥{formatYuanAmount(-member.balance_cents)}
                  </strong>
                ) : (
                  <strong>¥{formatYuanAmount(member.balance_cents)}</strong>
                )}
              </p>
            ) : null}
            <FormField
              control={form.control}
              name="amountYuan"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>充值金额（元）</FormLabel>
                  <div className="credit-amount-input">
                    <span aria-hidden="true">¥</span>
                    <Input
                      max={MAX_CREDIT_YUAN}
                      min={0.01}
                      onBlur={(event) =>
                        field.onChange(
                          event.target.value === ""
                            ? undefined
                            : Number(event.target.value),
                        )
                      }
                      onChange={(event) =>
                        field.onChange(
                          event.target.value === ""
                            ? undefined
                            : Number(event.target.value),
                        )
                      }
                      placeholder="例如 100"
                      step={10}
                      type="number"
                      value={field.value ?? ""}
                    />
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>备注（可选）</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="例如：线下现金收款" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button onClick={onClose} type="button" variant="outline">
                取消
              </Button>
              <Button disabled={submitting} type="submit">
                充值
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
