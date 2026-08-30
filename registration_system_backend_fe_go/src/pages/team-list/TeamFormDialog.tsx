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
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateTeamMutation,
  useUpdateTeamMutation,
} from "@/hooks/queries/useTeamQueries";
import type { Team } from "@/types/team";

const teamSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: "请输入球队名称" })
    .max(120, { message: "球队名称不能超过 120 个字符" }),
  description: z.string().max(1000, { message: "简介不能超过 1000 个字符" }),
  status: z.enum(["active", "frozen"]),
});

type TeamFormValues = z.infer<typeof teamSchema>;

function errorMessage(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

interface TeamFormDialogProps {
  open: boolean;
  team: Team | null;
  onClose: () => void;
}

export function TeamFormDialog({ open, team, onClose }: TeamFormDialogProps) {
  const createTeam = useCreateTeamMutation();
  const updateTeam = useUpdateTeamMutation();
  const [formError, setFormError] = useState("");
  const pending = createTeam.isPending || updateTeam.isPending;

  const form = useForm<TeamFormValues>({
    defaultValues: { name: "", description: "", status: "active" },
    resolver: zodResolver(teamSchema),
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      name: team?.name ?? "",
      description: team?.description ?? "",
      status: team?.status === "frozen" ? "frozen" : "active",
    });
    setFormError("");
  }, [open, team, form]);

  const submit = form.handleSubmit(async (values: TeamFormValues) => {
    setFormError("");
    try {
      if (team) {
        await updateTeam.mutateAsync({
          id: team.id,
          payload: {
            name: values.name.trim(),
            description: values.description.trim() || null,
            status: values.status,
          },
        });
      } else {
        await createTeam.mutateAsync({
          name: values.name.trim(),
          description: values.description.trim() || null,
        });
      }
      onClose();
    } catch (reason) {
      setFormError(errorMessage(reason, "球队保存失败"));
    }
  });

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      open={open}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{team ? "编辑球队" : "创建球队"}</DialogTitle>
          <DialogDescription>
            {team
              ? "修改球队基础信息与状态。"
              : "新球队创建后即可参与比赛报名。"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form className="dialog-form" onSubmit={submit}>
            {formError ? <ErrorAlert message={formError} /> : null}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>球队名称</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={120} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>球队简介</FormLabel>
                  <FormControl>
                    <Textarea {...field} maxLength={1000} rows={4} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {team ? (
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>球队状态</FormLabel>
                    <fieldset aria-label="球队状态" className="toggle-pair">
                      <button
                        data-active={field.value === "active"}
                        onClick={() => field.onChange("active")}
                        type="button"
                      >
                        启用
                      </button>
                      <button
                        data-active={field.value === "frozen"}
                        onClick={() => field.onChange("frozen")}
                        type="button"
                      >
                        冻结
                      </button>
                    </fieldset>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            <DialogFooter>
              <Button onClick={onClose} type="button" variant="outline">
                取消
              </Button>
              <Button disabled={pending} type="submit">
                {team ? "保存" : "创建"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
