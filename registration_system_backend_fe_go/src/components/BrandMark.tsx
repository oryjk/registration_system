interface BrandMarkProps {
  className?: string;
}

export function BrandMark({ className }: BrandMarkProps) {
  return <span className={className || "brand-symbol"}>KT</span>;
}
