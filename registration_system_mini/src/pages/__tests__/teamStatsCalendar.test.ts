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
      record("joined", "2026-06-04T12:00:00Z", 1),
      record("leave", "2026-06-11T12:00:00Z", 2),
      record("late", "2026-06-18T12:00:00Z", 3),
      record("unregistered", "2026-05-28T12:00:00Z", 0, false),
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


test("attendance calendar puts UTC and legacy timestamps in Beijing month/day cells", () => {
  const months = buildAttendanceCalendarMonths([
    record("utc", "2026-12-31T16:30:00Z", 1),
    record("legacy", "2026-12-31 17:00:00", 2),
    record("date", "2026-12-31", 1),
  ], new Date("2026-12-31T16:30:00Z"));
  expect(months.map(month => month.monthKey)).toEqual(["2027-01", "2026-12"]);
  const today = months[0].weeks.flatMap(week => week.days).find(day => day.dateKey === "2027-01-01");
  expect(today?.isToday).toEqual(true);
  expect(today?.records.map(item => item.timeLabel)).toEqual(["01:00", "00:30"]);
});
