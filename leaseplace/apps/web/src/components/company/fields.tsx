import type { ComponentProps, ReactNode } from "react";
import { cn } from "@leaseplace/ui/cn";
import { Label } from "@leaseplace/ui/label";

/** Champ de formulaire : libellé, contrôle, aide ou erreur. */
export function FormField({
  id,
  label,
  hint,
  error,
  children,
  className,
}: {
  id: string;
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p id={`${id}-erreur`} className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-fg-subtle">{hint}</p>
      ) : null}
    </div>
  );
}

/** Liste déroulante native, aux couleurs du design system. */
export function Select({ className, ...props }: ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-md border border-border-strong bg-surface px-3 text-sm text-fg shadow-sm focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none aria-invalid:border-danger",
        className,
      )}
      {...props}
    />
  );
}
