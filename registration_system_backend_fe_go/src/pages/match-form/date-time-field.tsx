import { zhCN } from "date-fns/locale";
import type { Dayjs } from "dayjs";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  fromCalendarDate,
  toCalendarDate,
  toShanghaiTime,
} from "@/utils/datetime";

interface DateTimeFieldProps {
  id?: string;
  value?: Dayjs;
  onChange: (value: Dayjs | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

function parseTimeInput(raw: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

/** DatePicker(showTime) 的等价物：弹层日历 + HH:mm 时间输入，值为 Dayjs。 */
export function DateTimeField({
  id,
  value,
  onChange,
  placeholder,
  disabled,
  "aria-label": ariaLabel,
}: DateTimeFieldProps) {
  const [open, setOpen] = useState(false);
  const shanghaiValue = value ? toShanghaiTime(value) : undefined;
  const today = toCalendarDate(toShanghaiTime());
  const selected = shanghaiValue ? toCalendarDate(shanghaiValue) : undefined;
  const [timeDraft, setTimeDraft] = useState(
    shanghaiValue?.format("HH:mm") ?? "",
  );

  const commitTime = (raw: string) => {
    const parsed = parseTimeInput(raw);
    if (!parsed) {
      setTimeDraft(shanghaiValue?.format("HH:mm") ?? "");
      return;
    }
    const next = fromCalendarDate(
      selected ?? today,
      parsed.hour,
      parsed.minute,
    );
    onChange(next);
    setTimeDraft(next.format("HH:mm"));
  };

  return (
    <Popover
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setTimeDraft(shanghaiValue?.format("HH:mm") ?? "");
      }}
      open={open}
    >
      <PopoverTrigger asChild>
        <Button
          aria-label={ariaLabel}
          className="date-time-trigger"
          disabled={disabled}
          id={id}
          type="button"
          variant="outline"
        >
          <CalendarIcon size={15} />
          {shanghaiValue
            ? shanghaiValue.format("YYYY-MM-DD HH:mm")
            : placeholder || "选择时间"}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="date-time-popover">
        <Calendar
          locale={zhCN}
          mode="single"
          selected={selected}
          today={today}
          defaultMonth={selected ?? today}
          onSelect={(date) => {
            if (!date) return;
            const parsed = parseTimeInput(timeDraft);
            const next = fromCalendarDate(
              date,
              parsed?.hour ?? shanghaiValue?.hour() ?? 0,
              parsed?.minute ?? shanghaiValue?.minute() ?? 0,
            );
            onChange(next);
          }}
        />
        <div className="date-time-time-row">
          <span>北京时间</span>
          <Input
            aria-label="时间"
            onBlur={(event) => commitTime(event.target.value)}
            onChange={(event) => setTimeDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitTime(timeDraft);
            }}
            placeholder="HH:mm"
            value={timeDraft}
          />
          <Button
            onClick={() => {
              setOpen(false);
              if (value) onChange(value);
            }}
            size="sm"
            type="button"
            variant="outline"
          >
            确定
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
