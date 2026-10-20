import { useId } from "react";
import { cn } from "../lib/cn";

/**
 * Motif zellige discret : étoile à huit branches (deux carrés croisés)
 * en tracé fin, répétée. Purement décoratif.
 */
export function Zellige({ className, size = 56 }: { className?: string; size?: number }) {
  const id = useId();
  const h = size / 2;
  const q = size * 0.2071; // (√2 − 1) / 2 × size : sommets de l'octogramme
  const star = [
    [h, 0],
    [h + q, h - q],
    [size, h],
    [h + q, h + q],
    [h, size],
    [h - q, h + q],
    [0, h],
    [h - q, h - q],
  ]
    .map(([x, y]) => `${String(x)},${String(y)}`)
    .join(" ");
  return (
    <svg
      aria-hidden="true"
      className={cn("pointer-events-none", className)}
      width="100%"
      height="100%"
    >
      <defs>
        <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse">
          <polygon points={star} fill="none" stroke="currentColor" strokeWidth="0.75" />
          <rect
            x={h - q}
            y={h - q}
            width={q * 2}
            height={q * 2}
            transform={`rotate(45 ${String(h)} ${String(h)})`}
            fill="none"
            stroke="currentColor"
            strokeWidth="0.75"
          />
          <circle cx={h} cy={h} r={size * 0.04} fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}
