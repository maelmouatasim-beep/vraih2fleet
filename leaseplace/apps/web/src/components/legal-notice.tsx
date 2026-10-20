import { ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { cn } from "@leaseplace/ui/cn";
import { brand } from "@/lib/brand";

/** Mention obligatoire (loi 103-12) : intermédiaire, ni fonds ni décision de crédit. */
export async function LegalNotice({ className }: { className?: string }) {
  const t = await getTranslations("legal");
  return (
    <p className={cn("flex items-start gap-2 text-xs leading-relaxed text-fg-subtle", className)}>
      <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <span>{t("intermediary", { brand: brand.name })}</span>
    </p>
  );
}
