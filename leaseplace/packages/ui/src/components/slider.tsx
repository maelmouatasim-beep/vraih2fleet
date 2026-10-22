import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

/**
 * Curseur natif (`input type="range"`) : clavier, lecteurs d'écran et sens de
 * lecture gérés par le navigateur, aucun JavaScript embarqué.
 */
export function Slider({
  className,
  label,
  valueText,
  value,
  onValueChange,
  ...props
}: Omit<ComponentProps<"input">, "type" | "value" | "onChange"> & {
  label: string;
  valueText?: string;
  value: number;
  onValueChange: (value: number) => void;
}) {
  return (
    <input
      type="range"
      aria-label={label}
      aria-valuetext={valueText}
      value={value}
      onChange={(e) => {
        onValueChange(Number(e.target.value));
      }}
      className={cn("lp-range w-full", className)}
      {...props}
    />
  );
}
