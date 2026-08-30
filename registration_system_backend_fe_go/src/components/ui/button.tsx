import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] text-sm font-semibold transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary-solid text-primary-foreground hover:bg-primary-solid-hover",
        secondary:
          "border border-border bg-card text-card-foreground hover:bg-muted",
        outline:
          "border border-border bg-card text-card-foreground hover:bg-muted",
        destructive:
          "bg-destructive text-primary-foreground hover:bg-destructive/90",
        ghost: "hover:bg-muted",
        link: "text-info-strong underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-9 px-3 py-1.5",
        sm: "min-h-7.5 rounded-[var(--radius)] px-2 py-1 text-xs font-medium",
        icon: "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
