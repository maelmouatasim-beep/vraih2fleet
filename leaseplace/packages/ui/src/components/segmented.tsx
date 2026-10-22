import { useId } from "react";
import { cn } from "../lib/cn";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/** Choix exclusif court : boutons radio natifs (flèches du clavier, aucune bibliothèque). */
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
  const name = useId();
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex w-full gap-1 rounded-lg bg-surface-sunken p-1", className)}
    >
      {options.map((o) => (
        <label key={o.value} className="relative flex-1">
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={o.value === value}
            onChange={() => {
              onChange(o.value);
            }}
            className="peer sr-only"
          />
          <span className="flex h-8 cursor-pointer items-center justify-center rounded-md px-2 text-center text-[13px] font-medium text-fg-muted transition-colors peer-checked:bg-surface peer-checked:text-fg peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-ring hover:text-fg">
            {o.label}
          </span>
        </label>
      ))}
    </div>
  );
}
