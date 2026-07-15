import ArrowLeftOutlined from "@ant-design/icons/es/icons/ArrowLeftOutlined";
import PlusOutlined from "@ant-design/icons/es/icons/PlusOutlined";
import Alert from "antd/es/alert";
import Button from "antd/es/button";
import DatePicker from "antd/es/date-picker";
import Form from "antd/es/form";
import Input from "antd/es/input";
import InputNumber from "antd/es/input-number";
import Modal from "antd/es/modal";
import Select from "antd/es/select";
import Space from "antd/es/space";
import Spin from "antd/es/spin";
import Typography from "antd/es/typography";
import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { createMatch, getMatch, updateMatch } from "../api/matches";
import { createTeam, listTeamOptions } from "../api/teams";
import type { CreateMatchPayload, PublicationMode } from "../types/match";
import type { TeamOption } from "../types/team";
import { publicationModeLabels } from "./matchLabels";

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
  const navigate = useNavigate();
  const [form] = Form.useForm<MatchFormValues>();
  const [confirmModal, modalContextHolder] = Modal.useModal();
  const pendingTeamName = useRef("");
  const mode = Form.useWatch("publication_mode", form);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(editing);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [teamSearch, setTeamSearch] = useState("");
  const [creatingTeam, setCreatingTeam] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const teamPromise = listTeamOptions();
    const detailPromise = id ? getMatch(id) : Promise.resolve(null);
    Promise.all([teamPromise, detailPromise])
      .then(([teamItems, detail]) => {
        if (!active) return;
        setTeams(teamItems);
        if (detail) {
          const match = detail.match;
          form.setFieldsValue({
            name: match.name,
            publication_mode: match.publication_mode,
            host_team_id: match.host_team_id,
            opponent_name: match.opponent_name || undefined,
            players_per_team: match.players_per_team,
            time_range: [dayjs(match.start_time), dayjs(match.end_time)],
            location: match.location,
            location_latitude: match.location_latitude || undefined,
            location_longitude: match.location_longitude || undefined,
            description: match.description || undefined,
          });
        }
      })
      .catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : "表单加载失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [form, id]);

  const submit = async (values: MatchFormValues) => {
    setSubmitting(true);
    setError("");
    const shared = {
      name: values.name.trim(),
      start_time: values.time_range[0].toISOString(),
      end_time: values.time_range[1].toISOString(),
      location: values.location.trim(),
      location_latitude: values.location_latitude ?? null,
      location_longitude: values.location_longitude ?? null,
      description: values.description?.trim() || null,
    };
    try {
      const result = id
        ? await updateMatch(id, shared)
        : await createMatch({
            ...shared,
            publication_mode: values.publication_mode,
            host_team_id: values.host_team_id,
            opponent_name: values.publication_mode === "offline_confirmed" ? values.opponent_name?.trim() || null : null,
            players_per_team: values.players_per_team,
            host_capacity_limit: values.host_capacity_limit ?? null,
          } satisfies CreateMatchPayload);
      navigate(`/matches/${result.match.id}`, { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "比赛保存失败");
    } finally {
      setSubmitting(false);
    }
  };

  const createAndSelectTeam = async (name: string, submitAfterCreate: boolean) => {
    setCreatingTeam(true);
    setError("");
    try {
      const team = await createTeam({ name, description: null });
      setTeams((current) => [...current, team].sort((left, right) => left.name.localeCompare(right.name, "zh-CN")));
      form.setFieldValue("host_team_id", team.id);
      setTeamSearch("");
      pendingTeamName.current = "";
      if (submitAfterCreate) {
        queueMicrotask(() => form.submit());
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "球队创建失败");
    } finally {
      setCreatingTeam(false);
    }
  };

  const selectOrConfirmTeam = (rawName: string, submitAfterCreate = false) => {
    const name = rawName.trim();
    if (!name || editing) return;
    const existing = teams.find((team) => team.name.trim().localeCompare(name, "zh-CN", { sensitivity: "accent" }) === 0);
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

  return (
    <main className="match-form-page">
      {modalContextHolder}
      <section className="page-heading detail-heading">
        <div className="detail-title-row">
          <Button type="text" shape="circle" icon={<ArrowLeftOutlined />} aria-label="返回" onClick={() => navigate(id ? `/matches/${id}` : "/matches")} />
          <div>
            <Text className="page-kicker">MATCH EDITOR</Text>
            <Title level={2}>{editing ? "编辑比赛" : "发布比赛"}</Title>
          </div>
        </div>
      </section>

      {error ? <Alert className="service-alert" type="error" showIcon message={error} /> : null}

      <section className="form-panel">
        <Spin spinning={loading}>
          <Form<MatchFormValues>
            form={form}
            layout="vertical"
            initialValues={initialValues}
            disabled={submitting}
            requiredMark={false}
            onFinish={submit}
            onFinishFailed={({ errorFields }) => {
              const typedTeamName = teamSearch.trim() || pendingTeamName.current.trim();
              if (!editing && typedTeamName && errorFields.some((field) => field.name[0] === "host_team_id")) {
                selectOrConfirmTeam(typedTeamName, true);
              }
            }}
          >
          <div className="form-section">
            <div className="form-section-title"><Text className="panel-kicker">BASIC</Text><Title level={4}>比赛信息</Title></div>
            <div className="form-grid">
              <Form.Item name="name" label="比赛名称" rules={[{ required: true, message: "请输入比赛名称" }]}>
                <Input maxLength={255} placeholder="例如：周末友谊赛" />
              </Form.Item>
              <Form.Item name="publication_mode" label="发布模式" rules={[{ required: true }]}>
                <Select disabled={editing} options={Object.entries(publicationModeLabels).map(([value, label]) => ({ value, label }))} />
              </Form.Item>
              <Form.Item
                name="host_team_id"
                label="主队"
                rules={[{ required: true, message: "请选择主队" }]}
              >
                <Select
                  showSearch
                  allowClear
                  disabled={editing || creatingTeam}
                  searchValue={teamSearch}
                  onSearch={(value) => {
                    setTeamSearch(value);
                    if (value.trim()) pendingTeamName.current = value;
                  }}
                  onInputKeyDown={(event) => {
                    const input = event.currentTarget;
                    queueMicrotask(() => { pendingTeamName.current = input.value; });
                  }}
                  onClear={() => { setTeamSearch(""); pendingTeamName.current = ""; }}
                  onSelect={() => { setTeamSearch(""); pendingTeamName.current = ""; }}
                  filterOption={(input, option) => String(option?.label || "").toLocaleLowerCase("zh-CN").includes(input.trim().toLocaleLowerCase("zh-CN"))}
                  placeholder={teams.length ? "选择主队" : "暂无可用球队"}
                  options={teams.map((team) => ({ value: team.id, label: team.name }))}
                  notFoundContent={teamSearch.trim() ? (
                    <div className="team-select-empty">
                      <Text type="secondary">未找到“{teamSearch.trim()}”</Text>
                      <Button
                        type="link"
                        size="small"
                        icon={<PlusOutlined />}
                        loading={creatingTeam}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => selectOrConfirmTeam(teamSearch)}
                      >
                        创建球队
                      </Button>
                    </div>
                  ) : null}
                />
              </Form.Item>
              <Form.Item name="players_per_team" label="每队人数" rules={[{ required: true }]}>
                <InputNumber min={1} max={30} disabled={editing} className="full-width-control" />
              </Form.Item>
              {mode === "offline_confirmed" ? (
                <Form.Item name="opponent_name" label="对手名称" rules={[{ required: true, message: "请输入线下对手名称" }]}>
                  <Input maxLength={255} />
                </Form.Item>
              ) : null}
              {!editing ? (
                <Form.Item name="host_capacity_limit" label="主队报名上限">
                  <InputNumber min={1} max={100} className="full-width-control" />
                </Form.Item>
              ) : null}
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-title"><Text className="panel-kicker">SCHEDULE</Text><Title level={4}>时间与场地</Title></div>
            <div className="form-grid">
              <Form.Item name="time_range" label="比赛时间" className="form-span-2" rules={[{ required: true, message: "请选择比赛时间" }]}>
                <RangePicker showTime format="YYYY-MM-DD HH:mm" className="full-width-control" />
              </Form.Item>
              <Form.Item name="location" label="比赛场地" className="form-span-2" rules={[{ required: true, message: "请输入比赛场地" }]}>
                <Input maxLength={255} />
              </Form.Item>
              <Form.Item name="location_latitude" label="纬度">
                <InputNumber min={-90} max={90} step={0.000001} className="full-width-control" />
              </Form.Item>
              <Form.Item name="location_longitude" label="经度">
                <InputNumber min={-180} max={180} step={0.000001} className="full-width-control" />
              </Form.Item>
              <Form.Item name="description" label="比赛说明" className="form-span-2">
                <Input.TextArea rows={4} maxLength={1000} showCount />
              </Form.Item>
            </div>
          </div>

          <div className="form-actions">
            <Space>
              <Button onClick={() => navigate(id ? `/matches/${id}` : "/matches")}>取消</Button>
              <Button type="primary" htmlType="submit" loading={submitting}>保存比赛</Button>
            </Space>
          </div>
          </Form>
        </Spin>
      </section>

    </main>
  );
}
