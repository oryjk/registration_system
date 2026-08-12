import { PlusOutlined } from "@ant-design/icons";
import { ProForm } from "@ant-design/pro-components/es/form/layouts/ProForm";
import { PageContainer } from "@ant-design/pro-components/es/layout/components/PageContainer";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Button,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Spin,
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
} from "../utils/match-form-payload";
import {
  publicationModeDescriptions,
  publicationModeLabels,
} from "./matchLabels";

const { RangePicker } = DatePicker;
const { Text, Title } = Typography;

interface MatchFormValues {
  name: string;
  publication_mode: PublicationMode;
  host_team_id: number;
  opponent_name?: string;
  players_per_team: number;
  host_capacity_limit?: number;
  time_range: [Dayjs, Dayjs];
  location: string;
  location_latitude?: number;
  location_longitude?: number;
  description?: string;
}

const initialValues: Partial<MatchFormValues> = {
  publication_mode: "online_team",
  players_per_team: 8,
  host_capacity_limit: 12,
};

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
  const formInitialValues: Partial<MatchFormValues> = match
    ? {
        name: match.name,
        publication_mode: match.publication_mode,
        host_team_id: match.host_team_id,
        opponent_name: match.opponent_name || undefined,
        players_per_team: match.players_per_team,
        time_range: [dayjs(match.start_time), dayjs(match.end_time)],
        location: match.location,
        location_latitude: match.location_latitude ?? undefined,
        location_longitude: match.location_longitude ?? undefined,
        description: match.description || undefined,
      }
    : initialValues;
  const formReady = !loading && (!editing || Boolean(match));

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
                  {!editing ? (
                    <Form.Item name="host_capacity_limit" label="主队报名上限">
                      <InputNumber
                        min={1}
                        max={100}
                        className="full-width-control"
                      />
                    </Form.Item>
                  ) : null}
                </div>
              </div>

              <div className="form-section">
                <div className="form-section-title">
                  <Text className="panel-kicker">SCHEDULE</Text>
                  <Title level={4}>时间与场地</Title>
                </div>
                <div className="form-grid">
                  <Form.Item
                    name="time_range"
                    label="比赛时间"
                    className="form-span-2"
                    rules={[{ required: true, message: "请选择比赛时间" }]}
                  >
                    <RangePicker
                      showTime
                      format="YYYY-MM-DD HH:mm"
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
