import type { UseFormReturn } from "react-hook-form";
import {
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DateTimeField } from "@/pages/match-form/date-time-field";
import type { MatchFormValues } from "@/pages/match-form/schema";

interface ScheduleSectionProps {
  form: UseFormReturn<MatchFormValues>;
  onStartTimeChange: (value: MatchFormValues["start_time"]) => void;
}

function numberFieldProps(
  field: { value: unknown; onChange: (value: unknown) => void },
  options: { min?: number; max?: number; step?: number } = {},
) {
  return {
    max: options.max,
    min: options.min,
    step: options.step,
    onBlur: (event: React.FocusEvent<HTMLInputElement>) =>
      field.onChange(
        event.target.value === "" ? undefined : event.target.valueAsNumber,
      ),
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      field.onChange(
        event.target.value === "" ? undefined : event.target.valueAsNumber,
      ),
    type: "number" as const,
    value:
      typeof field.value === "number" && Number.isFinite(field.value)
        ? field.value
        : "",
  };
}

export function ScheduleSection({
  form,
  onStartTimeChange,
}: ScheduleSectionProps) {
  return (
    <div className="form-section">
      <div className="form-section-title">
        <span className="panel-kicker">SCHEDULE</span>
        <h4>时间与场地</h4>
      </div>
      <div className="form-grid">
        <FormField
          control={form.control}
          name="start_time"
          render={({ field }) => (
            <FormItem>
              <FormLabel>比赛时间</FormLabel>
              <DateTimeField
                aria-label="比赛时间"
                onChange={(value) => {
                  field.onChange(value);
                  onStartTimeChange(value);
                }}
                placeholder="选择比赛开始时间"
                value={field.value}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="duration_minutes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>比赛时长（分钟）</FormLabel>
              <Input
                {...numberFieldProps(field, { max: 600, min: 30, step: 10 })}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="registration_start_at"
          render={({ field }) => (
            <FormItem>
              <FormLabel>报名开始时间</FormLabel>
              <DateTimeField
                aria-label="报名开始时间"
                onChange={field.onChange}
                placeholder="不限制开始时间"
                value={field.value}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="registration_end_at"
          render={({ field }) => (
            <FormItem>
              <FormLabel>报名截止时间</FormLabel>
              <DateTimeField
                aria-label="报名截止时间"
                onChange={field.onChange}
                placeholder="不限制截止时间"
                value={field.value}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="location"
          render={({ field }) => (
            <FormItem className="form-span-2">
              <FormLabel>比赛场地</FormLabel>
              <Input {...field} maxLength={255} />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="location_latitude"
          render={({ field }) => (
            <FormItem>
              <FormLabel>纬度</FormLabel>
              <Input
                {...numberFieldProps(field, {
                  max: 90,
                  min: -90,
                  step: 0.000001,
                })}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="location_longitude"
          render={({ field }) => (
            <FormItem>
              <FormLabel>经度</FormLabel>
              <Input
                {...numberFieldProps(field, {
                  max: 180,
                  min: -180,
                  step: 0.000001,
                })}
              />
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem className="form-span-2">
              <FormLabel>比赛说明</FormLabel>
              <Textarea {...field} maxLength={1000} rows={4} />
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
}
