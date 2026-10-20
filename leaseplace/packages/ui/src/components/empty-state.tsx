import type { ReactNode } from "react";
import { cn } from "../lib/cn";

/** État vide utile : ce qui manque, pourquoi, et l'action suivante. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border-strong bg-surface px-6 py-14 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="flex size-11 items-center justify-center rounded-lg bg-primary-soft text-primary-soft-fg [&_svg]:size-5">
          {icon}
        </div>
      ) : null}
      <div className="flex max-w-sm flex-col gap-1">
        <h2 className="text-[15px] font-semibold text-fg">{title}</h2>
        <p className="text-sm text-fg-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
