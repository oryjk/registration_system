import { type UseFormReturn, useWatch } from "react-hook-form";
import {
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
import { Switch } from "@/components/ui/switch";
import { JerseyColorField } from "@/pages/match-form/jersey-color-field";
import type { MatchFormValues } from "@/pages/match-form/schema";
import { TeamSelectField } from "@/pages/match-form/team-select-field";
import {
  publicationModeDescriptions,
  publicationModeLabels,
} from "@/pages/matchLabels";
import type { PublicationMode } from "@/types/match";
import type { TeamOption } from "@/types/team";

interface BasicSectionProps {
  form: UseFormReturn<MatchFormValues>;
  editing: boolean;
  teams: TeamOption[];
  teamSearch: string;
  onTeamSearchChange: (search: string) => void;
  onCreateTeam: (name: string) => void;
  creatingTeam: boolean;
  submitting: boolean;
}

export function BasicSection({
  form,
  editing,
  teams,
  teamSearch,
  onTeamSearchChange,
  onCreateTeam,
  creatingTeam,
  submitting,
}: BasicSectionProps) {
  const mode = useWatch({ control: form.control, name: "publication_mode" });

  return (
    <div className="form-section">
      <div className="form-section-title">
        <span className="panel-kicker">BASIC</span>
        <h4>比赛信息</h4>
      </div>
      <div className="form-grid">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>比赛名称</FormLabel>
              <Input
                {...field}
                maxLength={255}
                placeholder="例如：周末友谊赛"
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="publication_mode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>比赛类型</FormLabel>
              <Select
                disabled={editing}
                onValueChange={(value) =>
                  field.onChange(value as PublicationMode)
                }
                value={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.entries(publicationModeLabels)
                    .filter(([value]) => editing || value !== "online_pickup")
                    .map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        <span className="match-type-option">
                          <strong>{label}</strong>
                          <span>
                            {
                              publicationModeDescriptions[
                                value as PublicationMode
                              ]
                            }
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        {mode !== "online_pickup" ? (
          <FormField
            control={form.control}
            name="host_team_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>主队</FormLabel>
                <TeamSelectField
                  creating={creatingTeam}
                  disabled={editing || creatingTeam}
                  onChange={field.onChange}
                  onCreateTeam={onCreateTeam}
                  onSearchChange={onTeamSearchChange}
                  searchValue={teamSearch}
                  teams={teams}
                  value={field.value}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}
        <FormField
          control={form.control}
          name="players_per_team"
          render={({ field }) => (
            <FormItem>
              <FormLabel>每队人数</FormLabel>
              <Input
                disabled={editing}
                max={30}
                min={1}
                onBlur={(event) => {
                  field.onChange(event.target.valueAsNumber);
                }}
                onChange={(event) => field.onChange(event.target.valueAsNumber)}
                type="number"
                value={Number.isFinite(field.value) ? field.value : ""}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        {mode === "offline_confirmed" ? (
          <FormField
            control={form.control}
            name="opponent_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>对手名称</FormLabel>
                <Input {...field} maxLength={255} />
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}
        <FormField
          control={form.control}
          name="host_color"
          render={({ field }) => (
            <FormItem>
              <FormLabel>主队球服颜色</FormLabel>
              <JerseyColorField
                aria-label="主队球服颜色"
                onChange={field.onChange}
                value={field.value}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="away_color"
          render={({ field }) => (
            <FormItem>
              <FormLabel>客队球服颜色</FormLabel>
              <JerseyColorField
                aria-label="客队球服颜色"
                onChange={field.onChange}
                value={field.value}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        {!editing ? (
          <FormField
            control={form.control}
            name="is_free"
            render={({ field }) => (
              <FormItem>
                <FormLabel>免费报名</FormLabel>
                <div className="switch-field">
                  <Switch
                    checked={Boolean(field.value)}
                    onCheckedChange={field.onChange}
                  />
                  <span className="cell-secondary">
                    {field.value ? "免费" : "收费（默认）"}
                  </span>
                </div>
                <p className="form-field-hint">
                  开启后小程序详情的报名按钮会展示「免费」角标
                </p>
              </FormItem>
            )}
          />
        ) : null}
        <FormField
          control={form.control}
          name="host_capacity_limit"
          render={({ field }) => (
            <FormItem>
              <FormLabel>每队报名人数上限</FormLabel>
              <Input
                max={100}
                min={1}
                onBlur={(event) =>
                  field.onChange(
                    event.target.value === ""
                      ? undefined
                      : event.target.valueAsNumber,
                  )
                }
                onChange={(event) =>
                  field.onChange(
                    event.target.value === ""
                      ? undefined
                      : event.target.valueAsNumber,
                  )
                }
                disabled={submitting}
                type="number"
                value={field.value ?? ""}
              />
              <p className="form-field-hint">
                每队报名满员人数，超出后停止收人；默认为每队人数 +
                4，清空则本次不修改
              </p>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
