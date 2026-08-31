import { zodResolver } from "@hookform/resolvers/zod";
import dayjs from "dayjs";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate, useParams } from "react-router";
import { ErrorAlert } from "@/components/admin/error-alert";
import { RouteLoading } from "@/components/admin/route-loading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import {
  useCreateMatchMutation,
  useMatchQuery,
  useUpdateMatchMutation,
} from "@/hooks/queries/useMatchQueries";
import {
  useCreateTeamOptionMutation,
  useTeamOptionsQuery,
} from "@/hooks/queries/useTeamQueries";
import { BasicSection } from "@/pages/match-form/basic-section";
import { ScheduleSection } from "@/pages/match-form/schedule-section";
import {
  type MatchFormValues,
  matchFormSchema,
} from "@/pages/match-form/schema";
import {
  buildCreateMatchPayload,
  buildUpdateMatchPayload,
  defaultHostCapacityLimit,
} from "@/utils/match-form-payload";

const initialValues: MatchFormValues = {
  name: "",
  publication_mode: "online_team",
  players_per_team: 8,
  host_capacity_limit: defaultHostCapacityLimit(8),
  duration_minutes: 120,
  location: "",
  host_color: "#FFFFFF",
  away_color: "#FF0000",
};

export default function MatchFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [teamSearch, setTeamSearch] = useState("");
  const [confirmTeamName, setConfirmTeamName] = useState("");
  const pendingTeamName = useRef("");
  const formRef = useRef<HTMLFormElement>(null);
  const detailQuery = useMatchQuery(id || "");
  const teamsQuery = useTeamOptionsQuery();
  const createMutation = useCreateMatchMutation();
  const updateMutation = useUpdateMatchMutation();
  const createTeamMutation = useCreateTeamOptionMutation();
  const teams = teamsQuery.data || [];
  const submitting = createMutation.isPending || updateMutation.isPending;
  const loading = detailQuery.isLoading || teamsQuery.isLoading;
  const match = detailQuery.data?.match;
  // 编辑回填主队报名上限：优先用主队分组已配置的满员人数，缺失时按默认规则（每队人数 + 4）补齐。
  const hostGroup = detailQuery.data?.groups.find(
    (group) => group.kind === "host_team",
  );

  const form = useForm<MatchFormValues>({
    defaultValues: initialValues,
    resolver: zodResolver(matchFormSchema),
  });

  useEffect(() => {
    if (loading || (editing && !match)) return;
    if (match) {
      form.reset({
        name: match.name,
        publication_mode: match.publication_mode,
        host_team_id: match.host_team_id ?? undefined,
        opponent_name: match.opponent_name || undefined,
        players_per_team: match.players_per_team,
        host_capacity_limit:
          hostGroup?.max_players ??
          defaultHostCapacityLimit(match.players_per_team),
        start_time: dayjs(match.start_time),
        duration_minutes: Math.max(
          1,
          dayjs(match.end_time).diff(dayjs(match.start_time), "minute"),
        ),
        registration_start_at: match.registration_start_at
          ? dayjs(match.registration_start_at)
          : undefined,
        registration_end_at: match.registration_end_at
          ? dayjs(match.registration_end_at)
          : undefined,
        location: match.location,
        location_latitude: match.location_latitude ?? undefined,
        location_longitude: match.location_longitude ?? undefined,
        description: match.description || undefined,
        host_color: match.host_color || "#FFFFFF",
        away_color: match.away_color || "#FF0000",
      });
    } else {
      form.reset(initialValues);
    }
  }, [loading, editing, match, hostGroup, form]);

  // 选择比赛时间后自动带出报名窗口：报名开始默认为当前时间（仅在未填写时），
  // 报名截止固定为比赛开始前 2 小时，减少创建比赛的手工操作。
  const handleStartTimeChange = (value: MatchFormValues["start_time"]) => {
    if (!value) return;
    form.setValue(
      "registration_start_at",
      form.getValues("registration_start_at") ?? dayjs(),
    );
    form.setValue("registration_end_at", value.subtract(2, "hour"));
  };

  // 调整每队人数时同步主队报名上限默认值；管理员手动改过上限后不再跟随。
  useEffect(() => {
    const subscription = form.watch((values, { name }) => {
      if (name !== "players_per_team") return;
      if (form.getFieldState("host_capacity_limit").isTouched) return;
      const players = Number(values.players_per_team);
      if (Number.isFinite(players) && players > 0) {
        form.setValue(
          "host_capacity_limit",
          defaultHostCapacityLimit(players),
          {
            shouldTouch: false,
          },
        );
      }
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const submit = form.handleSubmit(
    async (values: MatchFormValues) => {
      // zod 校验已保证比赛时间存在；字面量捕获窄化类型以满足 payload 约定。
      if (!values.start_time) return;
      const payloadValues = { ...values, start_time: values.start_time };
      setError("");
      try {
        const result = id
          ? await updateMutation.mutateAsync({
              id,
              payload: buildUpdateMatchPayload(payloadValues),
            })
          : await createMutation.mutateAsync(
              buildCreateMatchPayload(payloadValues),
            );
        navigate(`/matches/${result.match.id}`, { replace: true });
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "比赛保存失败");
      }
    },
    (formErrors) => {
      // 提交校验失败且主队缺失：若正在输入新队名，转入“创建并选择”流程（保持 antd 版行为）。
      const typedTeamName = teamSearch.trim() || pendingTeamName.current.trim();
      if (!editing && typedTeamName && formErrors.host_team_id) {
        selectOrConfirmTeam(typedTeamName);
      }
    },
  );

  const createAndSelectTeam = async (
    name: string,
    submitAfterCreate: boolean,
  ) => {
    setError("");
    try {
      const team = await createTeamMutation.mutateAsync(name);
      form.setValue("host_team_id", team.id, { shouldValidate: true });
      setTeamSearch("");
      pendingTeamName.current = "";
      if (submitAfterCreate) {
        queueMicrotask(() => formRef.current?.requestSubmit());
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "球队创建失败");
    }
  };

  // “创建并选择”确认弹窗的上下文：记录确认后是否继续提交表单。
  const confirmContextRef = useRef({ submitAfterCreate: false });

  const selectOrConfirmTeam = (rawName: string, submitAfterCreate = false) => {
    const name = rawName.trim();
    if (!name || editing) return;
    const existing = teams.find(
      (team) =>
        team.name
          .trim()
          .localeCompare(name, "zh-CN", { sensitivity: "accent" }) === 0,
    );
    if (existing) {
      form.setValue("host_team_id", existing.id, { shouldValidate: true });
      setTeamSearch("");
      pendingTeamName.current = "";
      if (submitAfterCreate)
        queueMicrotask(() => formRef.current?.requestSubmit());
      return;
    }
    confirmContextRef.current.submitAfterCreate = submitAfterCreate;
    setConfirmTeamName(name);
  };

  const loadError = detailQuery.error || teamsQuery.error;
  const visibleError =
    error ||
    (loadError instanceof Error
      ? loadError.message
      : loadError
        ? "表单加载失败"
        : "");

  return (
    <div className="content-grid">
      <Card className="match-form-page">
        <CardHeader>
          <div className="detail-heading">
            <Button
              aria-label="返回"
              onClick={() => navigate(id ? `/matches/${id}` : "/matches")}
              size="icon"
              type="button"
              variant="outline"
            >
              <ArrowLeft size={16} />
            </Button>
            <CardTitle>{editing ? "编辑比赛" : "发布比赛"}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {visibleError ? (
            <ErrorAlert
              message={visibleError}
              onRetry={
                loadError
                  ? () => {
                      void teamsQuery.refetch();
                      if (id) void detailQuery.refetch();
                    }
                  : undefined
              }
            />
          ) : null}

          {loading ? <RouteLoading /> : null}

          {!loading && (!editing || match) ? (
            <Form {...form}>
              <form className="match-form" onSubmit={submit} ref={formRef}>
                <BasicSection
                  creatingTeam={createTeamMutation.isPending}
                  editing={editing}
                  form={form}
                  onCreateTeam={(name) => selectOrConfirmTeam(name)}
                  onTeamSearchChange={(value) => {
                    setTeamSearch(value);
                    if (value.trim()) pendingTeamName.current = value;
                  }}
                  submitting={submitting}
                  teamSearch={teamSearch}
                  teams={teams}
                />
                <ScheduleSection
                  form={form}
                  onStartTimeChange={handleStartTimeChange}
                />
                <div className="form-actions">
                  <Button
                    onClick={() => navigate(id ? `/matches/${id}` : "/matches")}
                    type="button"
                    variant="outline"
                  >
                    取消
                  </Button>
                  <Button disabled={submitting} type="submit">
                    保存比赛
                  </Button>
                </div>
              </form>
            </Form>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        onOpenChange={(open) => {
          if (!open) setConfirmTeamName("");
        }}
        open={Boolean(confirmTeamName)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>球队不存在</DialogTitle>
            <DialogDescription>
              {`是否创建“${confirmTeamName}”并设为本场比赛的主队？`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setConfirmTeamName("")}
              type="button"
              variant="outline"
            >
              返回
            </Button>
            <Button
              onClick={() => {
                const name = confirmTeamName;
                const submitAfter = confirmContextRef.current.submitAfterCreate;
                setConfirmTeamName("");
                void createAndSelectTeam(name, submitAfter);
              }}
              type="button"
            >
              创建并选择
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
