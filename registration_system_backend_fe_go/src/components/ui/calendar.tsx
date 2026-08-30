import * as React from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

import { cn } from "../../lib/utils";

export function Calendar({
  className,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      className={cn("provider-calendar", className)}
      showOutsideDays={showOutsideDays}
      {...props}
    />
  );
}
