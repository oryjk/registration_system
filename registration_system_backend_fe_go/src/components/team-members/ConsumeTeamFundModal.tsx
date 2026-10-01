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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { TeamMember } from "@/types/team";
import { formatYuan, formatYuanAmount } from "@/utils/format";
import { displayMemberName } from "./team-member-display";

export interface ConsumeTeamFundFormValues {
  amountYuan: number;
  reason: string;
  idempotencyKey: string;
}

/** 单笔消费扣费上限（元），与后端 teamfund 上限保持一致。 */
export const MAX_CONSUME_YUAN = 10000;

const consumeSchema = z.object({
  amountYuan: z
    .number({ invalid_type_error: "请输入扣费金额" })
    .positive({ message: "扣费金额需要大于 0" })
    .max(MAX_CONSUME_YUAN, {
      message: `单笔扣费不能超过 ${formatYuan(MAX_CONSUME_YUAN * 100)}，更大金额请拆分多笔`,
    }),
  reason: z
    .string()
    .trim()
    .min(1, { message: "请填写消费原因" })
    .max(40, { message: "消费原因不能超过 40 个字符" }),
});

interface ConsumeTeamFundModalProps {
  member: TeamMember | null;
  submitting: boolean;
  error: string;
  onSubmit: (values: ConsumeTeamFundFormValues) => void;
  onClose: () => void;
}

export function ConsumeTeamFundModal({
  member,
  submitting,
  error,
  onSubmit,
  onClose,
}: ConsumeTeamFundModalProps) {
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const form = useForm<z.infer<typeof consumeSchema>>({
    defaultValues: { amountYuan: undefined, reason: "" },
    resolver: zodResolver(consumeSchema),
  });

  useEffect(() => {
    if (!member) return;
    // 每次打开重新生成幂等键：同一意图重试共用一键，后端只记一笔。
    setIdempotencyKey(crypto.randomUUID());
    form.reset({ amountYuan: undefined, reason: "" });
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
            消费扣费 · {member ? displayMemberName(member) : ""}
          </DialogTitle>
          <DialogDescription>
            扣减该成员的队费余额；余额不足时将记为欠款（负数）。
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
                  <FormLabel>扣费金额（元）</FormLabel>
                  <div className="credit-amount-input">
                    <span aria-hidden="true">¥</span>
                    <Input
                      max={MAX_CONSUME_YUAN}
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
                      placeholder="例如 20"
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
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>消费原因（必填，40 字内）</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="例如：购买队服 / 场地分摊" />
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
                扣费
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
