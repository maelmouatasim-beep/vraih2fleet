"use client";

import { Slider as Primitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "../lib/cn";

/** Curseur à une valeur ; `label` nomme le curseur pour les lecteurs d'écran. */
export function Slider({
  className,
  label,
  valueText,
  ...props
}: ComponentProps<typeof Primitive.Root> & { label: string; valueText?: string }) {
  return (
    <Primitive.Root
      className={cn(
        "relative flex h-5 w-full touch-none items-center select-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      <Primitive.Track className="relative h-1.5 grow overflow-hidden rounded-full bg-surface-sunken">
        <Primitive.Range className="absolute h-full rounded-full bg-primary" />
      </Primitive.Track>
      <Primitive.Thumb
        aria-label={label}
        aria-valuetext={valueText}
        className="block size-4.5 rounded-full border-2 border-primary bg-surface shadow-sm transition-shadow hover:ring-4 hover:ring-primary/15 focus-visible:ring-4 focus-visible:ring-ring/30 focus-visible:outline-none"
      />
    </Primitive.Root>
  );
}
