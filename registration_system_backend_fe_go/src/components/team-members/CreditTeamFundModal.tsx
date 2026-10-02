import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { TeamMember } from "@/types/team";
import { isCalendarDate } from "@/utils/datetime";
import {
  formatShanghaiDateInput,
  formatYuan,
  formatYuanAmount,
} from "@/utils/format";
import { displayMemberName } from "./team-member-display";

export interface CreditTeamFundFormValues {
  amountYuan: number;
  note: string;
  receivedOn: string;
  idempotencyKey: string;
}

/** 单笔手动充值上限（元），与后端 teamfund.AdminCreditService 的上限保持一致。 */
export const MAX_CREDIT_YUAN = 10000;

const creditSchema = z.object({
  receivedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "请选择收款日期")
    .refine(isCalendarDate, "请选择有效的收款日期")
    .refine(
      (value) => value <= formatShanghaiDateInput(),
      "收款日期不能晚于今天",
    ),
  amountYuan: z
    .number({ invalid_type_error: "请输入充值金额" })
    .positive({ message: "充值金额需要大于 0" })
    .max(MAX_CREDIT_YUAN, {
      // MAX_CREDIT_YUAN 单位为元，formatYuan 接受分，故乘 100 对齐。
      message: `单笔手动充值不能超过 ${formatYuan(MAX_CREDIT_YUAN * 100)}，更大金额请拆分多笔`,
    }),
  note: z.string().max(40, { message: "备注不能超过 40 个字符" }),
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
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const form = useForm<z.infer<typeof creditSchema>>({
    defaultValues: {
      amountYuan: undefined,
      note: "",
      receivedOn: formatShanghaiDateInput(),
    },
    resolver: zodResolver(creditSchema),
  });

  useEffect(() => {
    if (!member) return;
    // 每次打开重新生成幂等键：同一意图重试共用一键，后端只记一笔。
    setIdempotencyKey(crypto.randomUUID());
    form.reset({
      amountYuan: undefined,
      note: "",
      receivedOn: formatShanghaiDateInput(),
    });
  }, [member, form]);

  const submit = form.handleSubmit((values) =>
    onSubmit({ ...values, idempotencyKey }),
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
            登记实际收到的线下款项并追加到该成员的队费余额；入账后自动标记付费会员。
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
                      step="0.01"
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
              name="receivedOn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>收款日期</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={submitting}
                      max={formatShanghaiDateInput()}
                      type="date"
                    />
                  </FormControl>
                  <FormDescription>
                    选择实际收到款项的日期，可补录之前的收款。
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="note"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>备注（可选，40 字内）</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      disabled={submitting}
                      maxLength={40}
                      placeholder="例如：线下现金收款"
                    />
                  </FormControl>
                  <fieldset aria-label="快捷备注" className="toolbar">
                    {["队费充值"].map((note) => (
                      <Button
                        disabled={submitting}
                        key={note}
                        onClick={() => field.onChange(note)}
                        size="sm"
                        type="button"
                        variant="outline"
                      >
                        {note}
                      </Button>
                    ))}
                  </fieldset>
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
