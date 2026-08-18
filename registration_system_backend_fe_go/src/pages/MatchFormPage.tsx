import { PlusOutlined } from "@ant-design/icons";
import { ProForm } from "@ant-design/pro-components/es/form/layouts/ProForm";
import { PageContainer } from "@ant-design/pro-components/es/layout/components/PageContainer";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  ColorPicker,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Spin,
  Switch,
  Typography,
} from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { useRef, useState } from "react";
import { history, useParams } from "umi";
import { createTeam, listTeamOptions } from "../api/teams";
import { queryKeys } from "../hooks/queries/keys";
import {
  useCreateMatchMutation,
  useMatchQuery,
  useUpdateMatchMutation,
} from "../hooks/queries/useMatchQueries";
import type { PublicationMode } from "../types/match";
import type { Team, TeamOption } from "../types/team";
import {
  buildCreateMatchPayload,
  buildUpdateMatchPayload,
  defaultHostCapacityLimit,
} from "../utils/match-form-payload";
import {
  publicationModeDescriptions,
  publicationModeLabels,
} from "./matchLabels";

const { Text, Title } = Typography;

interface MatchFormValues {
  name: string;
  publication_mode: PublicationMode;
  host_team_id: number;
  opponent_name?: string;
  players_per_team: number;
  host_capacity_limit?: number;
  start_time: Dayjs;
  duration_minutes: number;
  registration_start_at?: Dayjs;
  registration_end_at?: Dayjs;
  location: string;
  location_latitude?: number;
  location_longitude?: number;
  description?: string;
  host_color?: string;
  away_color?: string;
}

const initialValues: Partial<MatchFormValues> = {
  publication_mode: "online_team",
  players_per_team: 8,
  host_capacity_limit: defaultHostCapacityLimit(8),
  duration_minutes: 120,
  host_color: "#FFFFFF",
  away_color: "#FF0000",
};

// 常用球服颜色预设，主/客队 ColorPicker 共用。
const jerseyColorPresets = [
  {
    label: "常用球服色",
    colors: [
      "#FFFFFF",
      "#FF0000",
      "#2F6BFF",
      "#111310",
      "#C8FF00",
      "#FF6B35",
      "#B34DFF",
      "#D8DDE6",
    ],
  },
];

export default function MatchFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const [form] = Form.useForm<MatchFormValues>();
  const [confirmModal, modalContextHolder] = Modal.useModal();
  const pendingTeamName = useRef("");
  const mode = Form.useWatch("publication_mode", form);
  const [error, setError] = useState("");
  const [teamSearch, setTeamSearch] = useState("");
  const queryClient = useQueryClient();
  const detailQuery = useMatchQuery(id || "");
  const teamsQuery = useQuery({
    queryKey: queryKeys.teamOptions,
    queryFn: listTeamOptions,
    retry: false,
  });
  const createMutation = useCreateMatchMutation();
  const updateMutation = useUpdateMatchMutation();
  const createTeamMutation = useMutation({
    mutationFn: (name: string) => createTeam({ name, description: null }),
    onSuccess: (team) => {
      queryClient.setQueryData<Team[]>(queryKeys.teamOptions, (current = []) =>
        [...current.filter((item) => item.id !== team.id), team].sort(
          (left, right) => left.name.localeCompare(right.name, "zh-CN"),
        ),
      );
    },
  });
  const teams: TeamOption[] = teamsQuery.data || [];
  const submitting = createMutation.isPending || updateMutation.isPending;
  const loading = detailQuery.isLoading || teamsQuery.isLoading;
  const match = detailQuery.data?.match;
  // 编辑回填主队报名上限：优先用主队分组已配置的满员人数，缺失时按默认规则（每队人数 + 4）补齐。
  const hostGroup = detailQuery.data?.groups.find(
    (group) => group.kind === "host_team",
  );
  const formInitialValues: Partial<MatchFormValues> = match
    ? {
        name: match.name,
        publication_mode: match.publication_mode,
        host_team_id: match.host_team_id,
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
      }
    : initialValues;
  const formReady = !loading && (!editing || Boolean(match));

  // 选择比赛时间后自动带出报名窗口：报名开始默认为当前时间（仅在未填写时），
  // 报名截止固定为比赛开始前 2 小时，减少创建比赛的手工操作。
  const handleStartTimeChange = (value: Dayjs | null) => {
    if (!value) return;
    form.setFieldsValue({
      registration_start_at:
        form.getFieldValue("registration_start_at") ?? dayjs(),
      registration_end_at: value.subtract(2, "hour"),
    });
  };

  // 调整每队人数时同步主队报名上限默认值；管理员手动改过上限后不再跟随。
  const handlePlayersPerTeamChange = (value: number | null) => {
    if (form.isFieldTouched("host_capacity_limit")) return;
    form.setFieldsValue({
      host_capacity_limit: defaultHostCapacityLimit(value ?? 0),
    });
  };

  const submit = async (values: MatchFormValues) => {
    setError("");
    try {
      const result = id
        ? await updateMutation.mutateAsync({
            id,
            payload: buildUpdateMatchPayload(values),
          })
        : await createMutation.mutateAsync(buildCreateMatchPayload(values));
      history.replace(`/matches/${result.match.id}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "比赛保存失败");
    }
  };

  const createAndSelectTeam = async (
    name: string,
    submitAfterCreate: boolean,
  ) => {
    setError("");
    try {
      const team = await createTeamMutation.mutateAsync(name);
      form.setFieldValue("host_team_id", team.id);
      setTeamSearch("");
      pendingTeamName.current = "";
      if (submitAfterCreate) {
        queueMicrotask(() => form.submit());
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "球队创建失败");
    }
  };

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
      form.setFieldValue("host_team_id", existing.id);
      setTeamSearch("");
      pendingTeamName.current = "";
      if (submitAfterCreate) queueMicrotask(() => form.submit());
      return;
    }
    confirmModal.confirm({
      title: "球队不存在",
      content: `是否创建“${name}”并设为本场比赛的主队？`,
      okText: "创建并选择",
      cancelText: "返回",
      onOk: () => createAndSelectTeam(name, submitAfterCreate),
    });
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
    <PageContainer
      className="match-form-page"
      title={editing ? "编辑比赛" : "发布比赛"}
      onBack={() => history.push(id ? `/matches/${id}` : "/matches")}
    >
      {modalContextHolder}
      {visibleError ? (
        <Alert
          className="service-alert"
          type="error"
          showIcon
          message={visibleError}
          action={
            loadError ? (
              <Button
                size="small"
                onClick={() => {
                  void teamsQuery.refetch();
                  if (id) void detailQuery.refetch();
                }}
              >
                重试
              </Button>
            ) : null
          }
        />
      ) : null}

      <section className="form-panel">
        <Spin spinning={loading}>
          {formReady ? (
            <ProForm<MatchFormValues>
              form={form}
              layout="vertical"
              initialValues={formInitialValues}
              disabled={submitting}
              dateFormatter={false}
              requiredMark={false}
              submitter={false}
              onFinish={submit}
              onFinishFailed={({ errorFields }) => {
                const typedTeamName =
                  teamSearch.trim() || pendingTeamName.current.trim();
                if (
                  !editing &&
                  typedTeamName &&
                  errorFields.some((field) => field.name[0] === "host_team_id")
                ) {
                  selectOrConfirmTeam(typedTeamName, true);
                }
              }}
            >
              <div className="form-section">
                <div className="form-section-title">
                  <Text className="panel-kicker">BASIC</Text>
                  <Title level={4}>比赛信息</Title>
                </div>
                <div className="form-grid">
                  <Form.Item
                    name="name"
                    label="比赛名称"
                    rules={[{ required: true, message: "请输入比赛名称" }]}
                  >
                    <Input maxLength={255} placeholder="例如：周末友谊赛" />
                  </Form.Item>
                  <Form.Item
                    name="publication_mode"
                    label="比赛类型"
                    rules={[{ required: true }]}
                  >
                    <Select<PublicationMode>
                      disabled={editing}
                      options={Object.entries(publicationModeLabels).map(
                        ([value, label]) => ({
                          value: value as PublicationMode,
                          label,
                          description:
                            publicationModeDescriptions[
                              value as PublicationMode
                            ],
                        }),
                      )}
                      optionRender={(option) => (
                        <div className="match-type-option">
                          <Text strong>{option.data.label}</Text>
                          <Text type="secondary">
                            {option.data.description}
                          </Text>
                        </div>
                      )}
                    />
                  </Form.Item>
                  <Form.Item
                    name="host_team_id"
                    label="主队"
                    rules={[{ required: true, message: "请选择主队" }]}
                  >
                    <Select
                      showSearch
                      allowClear
                      disabled={editing || createTeamMutation.isPending}
                      searchValue={teamSearch}
                      onSearch={(value) => {
                        setTeamSearch(value);
                        if (value.trim()) pendingTeamName.current = value;
                      }}
                      onInputKeyDown={(event) => {
                        const input = event.currentTarget;
                        queueMicrotask(() => {
                          pendingTeamName.current = input.value;
                        });
                      }}
                      onClear={() => {
                        setTeamSearch("");
                        pendingTeamName.current = "";
                      }}
                      onSelect={() => {
                        setTeamSearch("");
                        pendingTeamName.current = "";
                      }}
                      filterOption={(input, option) =>
                        String(option?.label || "")
                          .toLocaleLowerCase("zh-CN")
                          .includes(input.trim().toLocaleLowerCase("zh-CN"))
                      }
                      placeholder={teams.length ? "选择主队" : "暂无可用球队"}
                      options={teams.map((team) => ({
                        value: team.id,
                        label: team.name,
                      }))}
                      notFoundContent={
                        teamSearch.trim() ? (
                          <div className="team-select-empty">
                            <Text type="secondary">
                              未找到“{teamSearch.trim()}”
                            </Text>
                            <Button
                              type="link"
                              size="small"
                              icon={<PlusOutlined />}
                              loading={createTeamMutation.isPending}
                              onMouseDown={(event) => event.preventDefault()}
                              onClick={() => selectOrConfirmTeam(teamSearch)}
                            >
                              创建球队
                            </Button>
                          </div>
                        ) : null
                      }
                    />
                  </Form.Item>
                  <Form.Item
                    name="players_per_team"
                    label="每队人数"
                    rules={[{ required: true }]}
                  >
                    <InputNumber
                      min={1}
                      max={30}
                      disabled={editing}
                      className="full-width-control"
                      onChange={handlePlayersPerTeamChange}
                    />
                  </Form.Item>
                  {mode === "offline_confirmed" ? (
                    <Form.Item
                      name="opponent_name"
                      label="对手名称"
                      rules={[
                        { required: true, message: "请输入线下对手名称" },
                      ]}
                    >
                      <Input maxLength={255} />
                    </Form.Item>
                  ) : null}
                  <Form.Item
                    name="host_color"
                    label="主队球服颜色"
                    getValueFromEvent={(color) => color.toHexString()}
                    rules={[
                      {
                        pattern: /^#[0-9a-fA-F]{6}$/,
                        message: "颜色格式必须为 #RRGGBB",
                      },
                    ]}
                  >
                    <ColorPicker showText presets={jerseyColorPresets} disabledAlpha />
                  </Form.Item>
                  <Form.Item
                    name="away_color"
                    label="客队球服颜色"
                    getValueFromEvent={(color) => color.toHexString()}
                    rules={[
                      {
                        pattern: /^#[0-9a-fA-F]{6}$/,
                        message: "颜色格式必须为 #RRGGBB",
                      },
                    ]}
                  >
                    <ColorPicker showText presets={jerseyColorPresets} disabledAlpha />
                  </Form.Item>
                  {!editing ? (
                    <Form.Item
                      name="is_free"
                      label="免费报名"
                      valuePropName="checked"
                      tooltip="默认收费；开启后小程序详情的报名按钮会展示「免费」角标"
                    >
                      <Switch />
                    </Form.Item>
                  ) : null}
                  <Form.Item
                    name="host_capacity_limit"
                    label="每队报名人数上限"
                    tooltip="每队报名满员人数，超出后停止收人；默认为每队人数 + 4，清空则本次不修改"
                  >
                    <InputNumber
                      min={1}
                      max={100}
                      className="full-width-control"
                    />
                  </Form.Item>
                </div>
              </div>

              <div className="form-section">
                <div className="form-section-title">
                  <Text className="panel-kicker">SCHEDULE</Text>
                  <Title level={4}>时间与场地</Title>
                </div>
                <div className="form-grid">
                  <Form.Item
                    name="start_time"
                    label="比赛时间"
                    rules={[{ required: true, message: "请选择比赛时间" }]}
                  >
                    <DatePicker
                      showTime
                      format="YYYY-MM-DD HH:mm"
                      placeholder="选择比赛开始时间"
                      className="full-width-control"
                      onChange={handleStartTimeChange}
                    />
                  </Form.Item>
                  <Form.Item
                    name="duration_minutes"
                    label="比赛时长（分钟）"
                    rules={[{ required: true, message: "请输入比赛时长" }]}
                  >
                    <InputNumber
                      min={30}
                      max={600}
                      step={10}
                      className="full-width-control"
                    />
                  </Form.Item>
                  <Form.Item name="registration_start_at" label="报名开始时间">
                    <DatePicker
                      showTime
                      format="YYYY-MM-DD HH:mm"
                      placeholder="不限制开始时间"
                      className="full-width-control"
                    />
                  </Form.Item>
                  <Form.Item
                    name="registration_end_at"
                    label="报名截止时间"
                    dependencies={["registration_start_at"]}
                    rules={[
                      ({ getFieldValue }) => ({
                        validator(_, value: Dayjs | undefined) {
                          const start = getFieldValue(
                            "registration_start_at",
                          ) as Dayjs | undefined;
                          if (!start || !value || value.isAfter(start)) {
                            return Promise.resolve();
                          }
                          return Promise.reject(
                            new Error("报名截止时间必须晚于开始时间"),
                          );
                        },
                      }),
                    ]}
                  >
                    <DatePicker
                      showTime
                      format="YYYY-MM-DD HH:mm"
                      placeholder="不限制截止时间"
                      className="full-width-control"
                    />
                  </Form.Item>
                  <Form.Item
                    name="location"
                    label="比赛场地"
                    className="form-span-2"
                    rules={[{ required: true, message: "请输入比赛场地" }]}
                  >
                    <Input maxLength={255} />
                  </Form.Item>
                  <Form.Item name="location_latitude" label="纬度">
                    <InputNumber
                      min={-90}
                      max={90}
                      step={0.000001}
                      className="full-width-control"
                    />
                  </Form.Item>
                  <Form.Item name="location_longitude" label="经度">
                    <InputNumber
                      min={-180}
                      max={180}
                      step={0.000001}
                      className="full-width-control"
                    />
                  </Form.Item>
                  <Form.Item
                    name="description"
                    label="比赛说明"
                    className="form-span-2"
                  >
                    <Input.TextArea rows={4} maxLength={1000} showCount />
                  </Form.Item>
                </div>
              </div>

              <div className="form-actions">
                <Space>
                  <Button
                    onClick={() =>
                      history.push(id ? `/matches/${id}` : "/matches")
                    }
                  >
                    取消
                  </Button>
                  <Button type="primary" htmlType="submit" loading={submitting}>
                    保存比赛
                  </Button>
                </Space>
              </div>
            </ProForm>
          ) : null}
        </Spin>
      </section>
    </PageContainer>
  );
}
