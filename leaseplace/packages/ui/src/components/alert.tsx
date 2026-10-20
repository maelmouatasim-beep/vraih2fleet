import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

const alertVariants = cva(
  "flex gap-3 rounded-md border px-3.5 py-3 text-sm [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      tone: {
        info: "border-info/20 bg-info-soft text-info",
        warning: "border-warning/25 bg-warning-soft text-warning",
        danger: "border-danger/20 bg-danger-soft text-danger",
        success: "border-success/20 bg-success-soft text-success",
        neutral: "border-border bg-surface-muted text-fg-muted",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export function Alert({
  className,
  tone,
  role = "status",
  ...props
}: ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div role={role} className={cn(alertVariants({ tone }), className)} {...props} />;
}
