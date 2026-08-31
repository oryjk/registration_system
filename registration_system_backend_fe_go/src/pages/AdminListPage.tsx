import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { ErrorAlert } from "@/components/admin/error-alert";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { useAdminSession } from "@/features/admin-session/useAdminSession";
import {
  useAdminsQuery,
  useCreateAdminMutation,
} from "@/hooks/queries/useAdminQueries";
import type { AdminUser } from "@/types/auth";
import { errorMessage } from "@/utils/error-message";
import { formatDateTime } from "@/utils/format";

const createAdminSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(1, { message: "请输入登录账号" })
      .max(64, { message: "账号不能超过 64 个字符" }),
    password: z.string().min(6, { message: "密码至少需要 6 个字符" }),
    confirm_password: z.string().min(1, { message: "请再次输入密码" }),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "两次输入的密码不一致",
    path: ["confirm_password"],
  });

type CreateAdminFormValue = z.infer<typeof createAdminSchema>;

export default function AdminListPage() {
  const { currentAdmin } = useAdminSession();
  const superAdmin = Boolean(currentAdmin?.is_super_admin);
  const adminsQuery = useAdminsQuery(superAdmin);
  const createAdmin = useCreateAdminMutation();
  const [formOpen, setFormOpen] = useState(false);
  const [formError, setFormError] = useState("");

  const form = useForm<CreateAdminFormValue>({
    defaultValues: { username: "", password: "", confirm_password: "" },
    resolver: zodResolver(createAdminSchema),
  });

  if (!superAdmin) {
    return (
      <main className="page-result">
        <div>
          <h3>无权访问</h3>
          <p>仅超级管理员可以管理场馆管理员</p>
        </div>
      </main>
    );
  }

  const openForm = () => {
    form.reset();
    setFormError("");
    setFormOpen(true);
  };

  const submit = form.handleSubmit(async (values: CreateAdminFormValue) => {
    setFormError("");
    try {
      await createAdmin.mutateAsync({
        username: values.username.trim(),
        password: values.password,
      });
      form.reset();
      setFormOpen(false);
    } catch (reason) {
      setFormError(errorMessage(reason, "场馆管理员创建失败"));
    }
  });

  const columns: DataTableColumn<AdminUser>[] = [
    {
      key: "username",
      title: "账号",
      render: (item) => <span className="cell-strong">{item.username}</span>,
    },
    {
      key: "role",
      title: "类型",
      width: 140,
      render: (item) =>
        item.role === "super_admin" ? (
          <StatusBadge label="超级管理员" variant="warning" />
        ) : (
          <StatusBadge label="场馆管理员" variant="success" />
        ),
    },
    {
      key: "status",
      title: "状态",
      width: 110,
      render: (item) =>
        item.status === "active" ? (
          <StatusBadge label="已启用" variant="success" />
        ) : (
          <StatusBadge label="已冻结" variant="warning" />
        ),
    },
    {
      key: "created_at",
      title: "创建时间",
      width: 190,
      render: (item) => formatDateTime(item.created_at),
    },
  ];

  return (
    <div className="content-grid">
      <Card>
        <CardHeader>
          <CardTitle>场馆管理员</CardTitle>
          <CardDescription>
            {`共 ${adminsQuery.data?.length || 0} 个管理账号`}
          </CardDescription>
          <CardAction>
            <Button onClick={openForm} type="button">
              <Plus size={15} />
              创建管理员
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="table-card-content">
          {adminsQuery.error ? (
            <ErrorAlert
              message={errorMessage(adminsQuery.error, "管理员列表加载失败")}
              onRetry={() => void adminsQuery.refetch()}
            />
          ) : null}

          <DataTable
            columns={columns}
            emptyText="暂无管理账号"
            items={adminsQuery.data}
            loading={adminsQuery.isFetching}
            rowKey={(item) => String(item.id)}
          />
        </CardContent>
      </Card>

      <Dialog
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setFormError("");
        }}
        open={formOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建场馆管理员</DialogTitle>
            <DialogDescription>
              新账号使用初始密码登录后即可访问场馆管理功能。
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form className="dialog-form" onSubmit={submit}>
              {formError ? <ErrorAlert message={formError} /> : null}
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>登录账号</FormLabel>
                    <FormControl>
                      <Input {...field} autoComplete="off" maxLength={64} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>初始密码</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoComplete="new-password"
                        type="password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirm_password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>确认密码</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        autoComplete="new-password"
                        type="password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  onClick={() => setFormOpen(false)}
                  type="button"
                  variant="outline"
                >
                  取消
                </Button>
                <Button disabled={createAdmin.isPending} type="submit">
                  创建
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
