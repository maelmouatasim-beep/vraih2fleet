import { cn } from "@leaseplace/ui/cn";
import { brand } from "@/lib/brand";

/** Marque : octogramme (zellige) dans un carré cèdre + mot-symbole. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-7 shrink-0", className)}>
      <rect width="32" height="32" rx="8" className="fill-primary" />
      <g className="fill-none stroke-primary-fg" strokeWidth="1.6" strokeLinejoin="round">
        <rect x="10" y="10" width="12" height="12" />
        <rect x="10" y="10" width="12" height="12" transform="rotate(45 16 16)" />
      </g>
      <circle cx="16" cy="16" r="2" className="fill-accent" />
    </svg>
  );
}

export function Logo({ className, subtle = false }: { className?: string; subtle?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark />
      <span className="text-[15px] font-semibold tracking-tight text-fg">
        {brand.name}
        {subtle ? null : <span className="ms-1 font-normal text-fg-subtle">{brand.tagline}</span>}
      </span>
    </span>
  );
}
