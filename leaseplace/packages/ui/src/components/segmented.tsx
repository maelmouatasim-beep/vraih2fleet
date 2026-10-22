"use client";

import { ToggleGroup } from "radix-ui";
import { cn } from "../lib/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/** Choix exclusif court (2 à 4 options) ; toujours une valeur sélectionnée. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  label: string;
  className?: string;
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      aria-label={label}
      onValueChange={(v) => {
        const next = options.find((o) => o.value === v);
        if (next) onChange(next.value);
      }}
      className={cn("inline-flex w-full gap-1 rounded-lg bg-surface-sunken p-1", className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className="h-8 flex-1 rounded-md px-2 text-[13px] font-medium text-fg-muted transition-colors hover:text-fg data-[state=on]:bg-surface data-[state=on]:text-fg data-[state=on]:shadow-sm"
        >
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}
