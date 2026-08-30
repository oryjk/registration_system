import dayjs, { type Dayjs } from "dayjs";
import { z } from "zod";
import type { PublicationMode } from "@/types/match";

export interface MatchFormValues {
  name: string;
  publication_mode: PublicationMode;
  host_team_id?: number;
  opponent_name?: string;
  players_per_team: number;
  host_capacity_limit?: number;
  start_time?: Dayjs;
  duration_minutes: number;
  registration_start_at?: Dayjs;
  registration_end_at?: Dayjs;
  location: string;
  location_latitude?: number;
  location_longitude?: number;
  description?: string;
  host_color?: string;
  away_color?: string;
  is_free?: boolean;
}

const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, { message: "颜色格式必须为 #RRGGBB" });

const isoDayjs = z.custom<Dayjs>((value) => dayjs.isDayjs(value), {
  message: "请选择时间",
});

const optionalDayjs = z.custom<Dayjs | undefined>(
  (value) => value === undefined || dayjs.isDayjs(value),
);

export const matchFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, { message: "请输入比赛名称" })
      .max(255, { message: "比赛名称不能超过 255 个字符" }),
    publication_mode: z.enum([
      "offline_confirmed",
      "online_team",
      "online_individual",
      "online_pickup",
    ]),
    host_team_id: z.number().int().positive().optional(),
    opponent_name: z.string().max(255).optional(),
    players_per_team: z
      .number({ invalid_type_error: "请输入每队人数" })
      .int()
      .min(1, { message: "每队人数至少 1 人" })
      .max(30, { message: "每队人数不能超过 30" }),
    host_capacity_limit: z
      .number({ invalid_type_error: "每队报名人数上限须为数字" })
      .int()
      .min(1, { message: "每队报名人数上限至少 1" })
      .max(100, { message: "每队报名人数上限不能超过 100" })
      .optional(),
    start_time: isoDayjs,
    duration_minutes: z
      .number({ invalid_type_error: "请输入比赛时长" })
      .int()
      .min(30, { message: "比赛时长至少 30 分钟" })
      .max(600, { message: "比赛时长不能超过 600 分钟" }),
    registration_start_at: optionalDayjs,
    registration_end_at: optionalDayjs,
    location: z
      .string()
      .trim()
      .min(1, { message: "请输入比赛场地" })
      .max(255, { message: "场地不能超过 255 个字符" }),
    location_latitude: z
      .number({ invalid_type_error: "纬度须为数字" })
      .min(-90, { message: "纬度范围为 -90 到 90" })
      .max(90, { message: "纬度范围为 -90 到 90" })
      .optional(),
    location_longitude: z
      .number({ invalid_type_error: "经度须为数字" })
      .min(-180, { message: "经度范围为 -180 到 180" })
      .max(180, { message: "经度范围为 -180 到 180" })
      .optional(),
    description: z
      .string()
      .max(1000, { message: "说明不能超过 1000 个字符" })
      .optional(),
    host_color: hexColor.optional(),
    away_color: hexColor.optional(),
    is_free: z.boolean().optional(),
  })
  .superRefine((values, context) => {
    if (values.publication_mode !== "online_pickup" && !values.host_team_id) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "请选择主队",
        path: ["host_team_id"],
      });
    }
    if (
      values.publication_mode === "offline_confirmed" &&
      !values.opponent_name?.trim()
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "请输入线下对手名称",
        path: ["opponent_name"],
      });
    }
    if (
      values.registration_start_at &&
      values.registration_end_at &&
      !values.registration_end_at.isAfter(values.registration_start_at)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "报名截止时间必须晚于开始时间",
        path: ["registration_end_at"],
      });
    }
  });
