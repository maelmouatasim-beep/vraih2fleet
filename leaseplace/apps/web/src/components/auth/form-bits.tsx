import { AlertCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Alert } from "@leaseplace/ui/alert";
import { Label } from "@leaseplace/ui/label";

export function Field({
  id,
  label,
  children,
  hint,
}: {
  id: string;
  label: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-fg-subtle">{hint}</p> : null}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <Alert tone="danger" role="alert">
      <AlertCircle aria-hidden="true" />
      <span>{message}</span>
    </Alert>
  );
}
