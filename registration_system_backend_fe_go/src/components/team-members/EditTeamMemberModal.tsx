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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AssignableTeamMemberRole, TeamMember } from "@/types/team";
import {
  assignableRoleOptions,
  displayMemberName,
} from "./team-member-display";

export interface EditMemberFormValues {
  realName: string;
  phoneNumber: string;
  role: AssignableTeamMemberRole;
  status: "active" | "inactive";
}

const editMemberSchema = z.object({
  realName: z.string().max(120, { message: "真实姓名不能超过 120 个字符" }),
  phoneNumber: z.string().max(32, { message: "手机号不能超过 32 个字符" }),
  role: z.enum(["leader", "vice_captain", "member"]),
  status: z.enum(["active", "inactive"]),
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
    });
  }, [member, form]);

  const submit = form.handleSubmit((values) =>
    onSubmit({
      realName: values.realName,
      phoneNumber: values.phoneNumber,
      role: values.role,
      status: values.status,
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
          <DialogDescription>更新球员资料与成员角色状态。</DialogDescription>
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
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>成员角色</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
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
