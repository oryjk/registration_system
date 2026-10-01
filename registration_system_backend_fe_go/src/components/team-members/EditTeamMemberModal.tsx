import { zodResolver } from "@hookform/resolvers/zod";
import dayjs from "dayjs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { AssignableTeamMemberRole, TeamMember } from "@/types/team";
import { formatYuanAmount } from "@/utils/format";
import {
  assignableRoleOptions,
  displayMemberName,
} from "./team-member-display";

export interface EditMemberFormValues {
  realName: string;
  phoneNumber: string;
  role: AssignableTeamMemberRole;
  status: "active" | "inactive";
  isPaidMember: boolean;
}

const editMemberSchema = z.object({
  realName: z.string().max(120, { message: "真实姓名不能超过 120 个字符" }),
  phoneNumber: z.string().max(32, { message: "手机号不能超过 32 个字符" }),
  role: z.enum(["leader", "vice_captain", "member"]),
  status: z.enum(["active", "inactive"]),
  isPaidMember: z.boolean(),
});

interface EditTeamMemberModalProps {
  member: TeamMember | null;
  submitting: boolean;
  error: string;
  onSubmit: (values: EditMemberFormValues) => void;
  onClose: () => void;
}

export function EditTeamMemberModal({
  member,
  submitting,
  error,
  onSubmit,
  onClose,
}: EditTeamMemberModalProps) {
  const form = useForm<z.infer<typeof editMemberSchema>>({
    defaultValues: {
      realName: "",
      phoneNumber: "",
      role: "member",
      status: "active",
      isPaidMember: false,
    },
    resolver: zodResolver(editMemberSchema),
  });

  useEffect(() => {
    if (!member) return;
    form.reset({
      realName: member.real_name ?? "",
      phoneNumber: member.phone_number ?? "",
      role:
        member.role === "captain" || member.role === "member"
          ? "member"
          : member.role,
      status: member.status === "inactive" ? "inactive" : "active",
      isPaidMember: member.is_paid_member,
    });
  }, [member, form]);

  const submit = form.handleSubmit((values) =>
    onSubmit({
      realName: values.realName,
      phoneNumber: values.phoneNumber,
      role: values.role,
      status: values.status,
      isPaidMember: values.isPaidMember,
    }),
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
            {member ? `编辑${displayMemberName(member)}` : "编辑成员"}
          </DialogTitle>
          <DialogDescription>
            更新球员资料、成员角色，以及该队内的付费会员与队费账户信息。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="dialog-form" onSubmit={submit}>
            {error ? <ErrorAlert message={error} /> : null}
            <FormField
              control={form.control}
              name="realName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>真实姓名</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete="name"
                      placeholder="未填写"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>手机号</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="未填写"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {member?.role === "captain" ? (
              <FormItem>
                <FormLabel>成员角色</FormLabel>
                <p className="cell-secondary">
                  队长 · 如需变更角色，请使用成员列表中的队长操作。
                </p>
              </FormItem>
            ) : (
              <>
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>成员角色</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {assignableRoleOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>成员状态</FormLabel>
                      <fieldset aria-label="成员状态" className="toggle-pair">
                        <button
                          data-active={field.value === "active"}
                          onClick={() => field.onChange("active")}
                          type="button"
                        >
                          启用
                        </button>
                        <button
                          data-active={field.value === "inactive"}
                          onClick={() => field.onChange("inactive")}
                          type="button"
                        >
                          冻结
                        </button>
                      </fieldset>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}
            <FormField
              control={form.control}
              name="isPaidMember"
              render={({ field }) => (
                <FormItem>
                  <div className="setting-row-head">
                    <Switch
                      aria-label="付费会员"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                    <FormLabel>付费会员</FormLabel>
                    <span className="cell-secondary">
                      {field.value ? "已缴队费" : "普通队员"}
                    </span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            {member ? (
              <div className="detail-grid">
                <p className="cell-secondary">
                  队费余额：
                  {member.balance_cents < 0 ? (
                    <strong className="credit-balance-debt">
                      欠款 ¥{formatYuanAmount(-member.balance_cents)}
                    </strong>
                  ) : (
                    <strong>¥{formatYuanAmount(member.balance_cents)}</strong>
                  )}
                </p>
                <p className="cell-secondary">
                  最近充值：
                  <strong>
                    {member.last_recharge_at
                      ? dayjs(member.last_recharge_at).format(
                          "YYYY-MM-DD HH:mm",
                        )
                      : "—"}
                  </strong>
                </p>
                <p className="cell-secondary">
                  余额由充值、消费扣费与冲正产生，不能在此直接修改；
                  请使用成员列表的「充值 / 扣费 / 流水」操作。
                </p>
              </div>
            ) : null}
            <DialogFooter>
              <Button onClick={onClose} type="button" variant="outline">
                取消
              </Button>
              <Button disabled={submitting} type="submit">
                保存
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
