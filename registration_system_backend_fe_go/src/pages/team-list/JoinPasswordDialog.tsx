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
import { useResetTeamJoinPasswordMutation } from "@/hooks/queries/useTeamQueries";
import type { Team } from "@/types/team";

const joinPasswordSchema = z.object({
  joinPassword: z.string().max(64, { message: "密码不能超过 64 个字符" }),
});

type JoinPasswordFormValues = z.infer<typeof joinPasswordSchema>;

interface JoinPasswordDialogProps {
  team: Team | null;
  onClose: () => void;
}

export function JoinPasswordDialog({ team, onClose }: JoinPasswordDialogProps) {
  const resetJoinPassword = useResetTeamJoinPasswordMutation();
  const [passwordError, setPasswordError] = useState("");

  const form = useForm<JoinPasswordFormValues>({
    defaultValues: { joinPassword: "" },
    resolver: zodResolver(joinPasswordSchema),
  });

  useEffect(() => {
    if (!team) return;
    form.reset({ joinPassword: "" });
    setPasswordError("");
  }, [team, form]);

  const submit = form.handleSubmit(async (values: JoinPasswordFormValues) => {
    if (!team) return;
    setPasswordError("");
    try {
      await resetJoinPassword.mutateAsync({
        teamID: team.id,
        password: values.joinPassword.trim(),
      });
      onClose();
    } catch (reason) {
      setPasswordError(
        reason instanceof Error ? reason.message : "入队密码保存失败",
      );
    }
  });

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      open={Boolean(team)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{`重置「${team?.name ?? ""}」入队密码`}</DialogTitle>
          <DialogDescription>
            密码以加密形式存储，无法查看原值。
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="dialog-form" onSubmit={submit}>
            {passwordError ? <ErrorAlert message={passwordError} /> : null}
            <FormField
              control={form.control}
              name="joinPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>新密码</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      autoComplete="new-password"
                      maxLength={64}
                      type="password"
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="form-field-hint">
                    留空提交即清除密码，球队将开放加入。
                  </p>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button onClick={onClose} type="button" variant="outline">
                取消
              </Button>
              <Button disabled={resetJoinPassword.isPending} type="submit">
                保存
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
