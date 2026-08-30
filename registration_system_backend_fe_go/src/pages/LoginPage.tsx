import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate } from "react-router";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { useLoginMutation } from "@/hooks/queries/useAuthQueries";
import { sanitizeRedirect } from "@/utils/auth-redirect";

const loginSchema = z.object({
  username: z.string().min(1, { message: "请输入管理员账号" }),
  password: z.string().min(1, { message: "请输入密码" }),
});

type LoginFormValue = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { currentAdmin, login } = useAdminSession();
  const loginMutation = useLoginMutation();
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const destination = sanitizeRedirect(
    new URLSearchParams(location.search).get("redirect"),
  );

  const form = useForm<LoginFormValue>({
    defaultValues: { username: "", password: "" },
    resolver: zodResolver(loginSchema),
  });

  if (currentAdmin) return <Navigate replace to={destination} />;

  const submit = form.handleSubmit(async (values: LoginFormValue) => {
    setError("");
    try {
      const result = await loginMutation.mutateAsync(values);
      login(result.admin);
      navigate(destination, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败");
    }
  });

  return (
    <main className="login-page">
      <div aria-hidden="true" className="login-grid-bg" />
      <div aria-hidden="true" className="login-glow login-glow-teal" />
      <div aria-hidden="true" className="login-glow login-glow-amber" />
      <div aria-hidden="true" className="login-vignette" />
      <div aria-hidden="true" className="login-noise" />

      <div className="login-auth-wrap">
        <Card className="login-auth">
          <span aria-hidden="true" className="login-corner login-corner-tl" />
          <span aria-hidden="true" className="login-corner login-corner-tr" />
          <span aria-hidden="true" className="login-corner login-corner-bl" />
          <span aria-hidden="true" className="login-corner login-corner-br" />
          <span aria-hidden="true" className="login-scan" />
          <CardContent className="login-auth-content">
            <div className="login-auth-head">
              <span className="login-auth-id">{"KT // ADMIN"}</span>
              <span>SECURE ACCESS</span>
            </div>
            <div className="login-auth-title">
              <h2>开踢管理台</h2>
              <p>赛事与球队运营控制中枢</p>
            </div>

            <Form {...form}>
              <form className="login-form" onSubmit={submit}>
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem className="login-field">
                      <FormLabel>账号</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          autoComplete="username"
                          placeholder="管理员账号"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="login-field">
                      <FormLabel>密码</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          autoComplete="current-password"
                          placeholder="密码"
                          type="password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {error ? (
                  <div aria-live="polite" className="login-error" role="alert">
                    {error}
                  </div>
                ) : null}
                <Button
                  className="login-submit"
                  disabled={loginMutation.isPending}
                  type="submit"
                >
                  {loginMutation.isPending ? "登录中" : "登录"}
                  <ArrowRight size={15} />
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
