import type { HomeMatchCardViewModel } from "@/types/viewModels";
import { formatWeekdayLabel } from "@/utils/datetime";

export function formatHomeMatchDateBlock(match: Pick<HomeMatchCardViewModel, "dateLabel" | "dateSource">) {
  const [monthDay = "", timeLabel = ""] = match.dateLabel.split(" ");

  return {
    monthDay,
    weekday: formatWeekdayLabel(match.dateSource ?? match.dateLabel),
    timeLabel,
  };
}
