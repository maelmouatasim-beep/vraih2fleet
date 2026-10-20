import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-fg shadow-sm transition-[border-color,box-shadow] placeholder:text-fg-subtle",
        "focus-visible:border-ring focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/20",
        "aria-invalid:border-danger aria-invalid:ring-danger/15 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  );
}
