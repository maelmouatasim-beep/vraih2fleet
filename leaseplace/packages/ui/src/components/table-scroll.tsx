import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

/**
 * Conteneur de tableau à défilement horizontal, atteignable au clavier
 * (WCAG 2.1.1 : une zone qui défile doit pouvoir recevoir le focus).
 */
export function TableScroll({
  label,
  className,
  ...props
}: ComponentProps<"div"> & { label: string }) {
  return (
    <div
      role="region"
      aria-label={label}
      tabIndex={0}
      className={cn(
        "overflow-x-auto focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
        className,
      )}
      {...props}
    />
  );
}
