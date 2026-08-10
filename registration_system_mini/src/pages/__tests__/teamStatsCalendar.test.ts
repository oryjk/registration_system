import { describe, expect, test } from "bun:test";
import { buildAttendanceCalendarMonths } from "../teams/teamStatsState";
import { sourcePath } from "@/test/sourcePaths";
import type { BackendTeamMemberAttendanceRecord } from "@/types/backend";

declare const Bun: {
  file(path: string): {
    text(): Promise<string>;
  };
};

const calendarCardPath = sourcePath("pages/teams/components/AttendanceCalendarCard.vue");

function record(
  activityId: string,
  holdingDate: string,
  stand: number,
  registered = true,
): BackendTeamMemberAttendanceRecord {
  return {
    activity_id: activityId,
    activity_name: `比赛 ${activityId}`,
    holding_date: holdingDate,
    location: "悦享动运动公园",
    stand,
    registration_count: registered ? 1 : 0,
    operation_time: holdingDate,
    registered,
  };
}

describe("team stats attendance calendar", () => {
  test("groups match records into month calendar cells with attendance status marks", () => {
    const months = buildAttendanceCalendarMonths([
      record("joined", "2026-06-04T20:00:00", 1),
      record("leave", "2026-06-11T20:00:00", 2),
      record("late", "2026-06-18T20:00:00", 3),
      record("unregistered", "2026-05-28T20:00:00", 0, false),
    ]);

    expect(months.map((item) => item.monthKey)).toEqual(["2026-06", "2026-05"]);
    expect(months[0].weeks.length >= 5).toEqual(true);
    expect(months[0].weeks.every((week) => week.days.length === 7)).toEqual(true);

    const juneDays = months[0].weeks.flatMap((week) => week.days);
    const joinedDay = juneDays.find((day) => day.dateKey === "2026-06-04");
    const leaveDay = juneDays.find((day) => day.dateKey === "2026-06-11");
    const uncheckedDay = juneDays.find((day) => day.dateKey === "2026-06-18");
    const mayDays = months[1].weeks.flatMap((week) => week.days);
    const unregisteredDay = mayDays.find((day) => day.dateKey === "2026-05-28");

    expect(joinedDay?.records[0]?.statusLabel).toEqual("参加");
    expect(leaveDay?.records[0]?.statusLabel).toEqual("请假");
    expect(uncheckedDay?.records[0]?.statusLabel).toEqual("未打卡");
    expect(uncheckedDay?.records[0]?.statusTone).toEqual("unchecked");
    expect(unregisteredDay?.records[0]?.statusLabel).toEqual("未打卡");
    expect(unregisteredDay?.records[0]?.statusTone).toEqual("unchecked");
  });

  test("opens match name and location from calendar days instead of rendering a month detail list", async () => {
    const source = await Bun.file(calendarCardPath).text();

    expect(source.includes("@tap=\"openDayMatches(day)\"")).toEqual(true);
    expect(source.includes("calendar-popup")).toEqual(true);
    expect(source.includes("record.activityName")).toEqual(true);
    expect(source.includes("record.location")).toEqual(true);
    expect(source.includes("calendar-match-list")).toEqual(false);
    expect(source.includes("record.statusLabel }}</text>")).toEqual(false);
    expect(source.includes("record.registrationCount")).toEqual(false);
  });
});
