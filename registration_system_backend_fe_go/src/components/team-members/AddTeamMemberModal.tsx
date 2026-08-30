import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";
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
import type { TeamMemberCandidate, TeamMemberRole } from "@/types/team";
import { addMemberRoleOptions } from "./team-member-display";

export interface AddMemberFormValues {
  userID: number;
  role: TeamMemberRole;
}

const addMemberSchema = z.object({
  userID: z
    .number({ invalid_type_error: "请选择需要添加的球员" })
    .int()
    .positive({ message: "请选择需要添加的球员" }),
  role: z.enum(["captain", "leader", "vice_captain", "member"]),
});

interface AddTeamMemberModalProps {
  open: boolean;
  candidates: TeamMemberCandidate[];
  loadingCandidates: boolean;
  submitting: boolean;
  error: string;
  hasCaptain: boolean;
  onSearch: (value: string) => void;
  onSubmit: (values: AddMemberFormValues) => void;
  onClose: () => void;
}

function candidateLabel(candidate: TeamMemberCandidate) {
  const name =
    candidate.real_name?.trim() || candidate.nickname.trim() || "未设置姓名";
  return `${name}${candidate.phone_number ? ` · ${candidate.phone_number}` : ""} · ID ${candidate.user_id}`;
}

export function AddTeamMemberModal({
  open,
  candidates,
  loadingCandidates,
  submitting,
  error,
  hasCaptain,
  onSearch,
  onSubmit,
  onClose,
}: AddTeamMemberModalProps) {
  const form = useForm<z.infer<typeof addMemberSchema>>({
    defaultValues: { userID: undefined, role: "member" },
    resolver: zodResolver(addMemberSchema),
  });

  useEffect(() => {
    if (open) form.reset({ userID: undefined, role: "member" });
  }, [open, form]);

  const submit = form.handleSubmit((values) =>
    onSubmit({ userID: values.userID, role: values.role }),
  );

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      open={open}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>添加球队成员</DialogTitle>
          <DialogDescription>
            先查询球员，再选择角色加入球队。
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form className="dialog-form" onSubmit={submit}>
            {error ? <ErrorAlert message={error} /> : null}
            <div className="field-row">
              <Input
                aria-label="查询球员"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    onSearch(event.currentTarget.value);
                  }
                }}
                placeholder="输入姓名、昵称、手机号或用户 ID 后回车"
              />
              <Button
                onClick={(event) => {
                  const input = event.currentTarget
                    .previousElementSibling as HTMLInputElement | null;
                  onSearch(input?.value ?? "");
                }}
                type="button"
                variant="outline"
              >
                <Search size={15} />
                查询
              </Button>
            </div>
            <FormField
              control={form.control}
              name="userID"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>选择球员</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(Number(value))}
                    value={field.value ? String(field.value) : undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            loadingCandidates
                              ? "正在加载候选球员"
                              : "请选择球员"
                          }
                        />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {candidates.map((candidate) => (
                        <SelectItem
                          key={candidate.user_id}
                          value={String(candidate.user_id)}
                        >
                          {candidateLabel(candidate)}
                        </SelectItem>
                      ))}
                      {!loadingCandidates && candidates.length === 0 ? (
                        <div className="select-empty-hint">
                          没有可添加的球员
                        </div>
                      ) : null}
                    </SelectContent>
                  </Select>
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
                      {addMemberRoleOptions.map((option) => (
                        <SelectItem
                          disabled={option.value === "captain" && hasCaptain}
                          key={option.value}
                          value={option.value}
                        >
                          {option.value === "captain" && hasCaptain
                            ? "队长（已有队长）"
                            : option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button onClick={onClose} type="button" variant="outline">
                取消
              </Button>
              <Button disabled={submitting} type="submit">
                添加
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
