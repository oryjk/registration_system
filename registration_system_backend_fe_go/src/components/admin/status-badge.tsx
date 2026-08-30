import { Badge } from "@/components/ui/badge";

type BadgeVariant =
  | "default"
  | "status"
  | "secondary"
  | "outline"
  | "destructive"
  | "success"
  | "warning"
  | "info";

const BADGE_VARIANTS = new Set<string>([
  "default",
  "status",
  "secondary",
  "outline",
  "destructive",
  "success",
  "warning",
  "info",
]);

/** 语义色来自映射表（matchLabels 等），运行时收敛为合法 Badge variant。 */
export function StatusBadge({
  label,
  variant,
}: {
  label: string;
  variant: string;
}) {
  const resolved = BADGE_VARIANTS.has(variant)
    ? (variant as BadgeVariant)
    : "secondary";
  return <Badge variant={resolved}>{label}</Badge>;
}
