import { ChevronDown } from "lucide-react";

export interface FaqItem {
  q: string;
  a: string;
}

/** FAQ en <details> natifs : accessible au clavier sans JavaScript. */
export function Faq({ items }: { items: readonly FaqItem[] }) {
  return (
    <div className="divide-y divide-border rounded-lg border border-border bg-surface">
      {items.map((item) => (
        <details key={item.q} className="group px-5">
          <summary className="flex cursor-pointer list-none items-center gap-3 py-4 text-[15px] font-medium text-fg [&::-webkit-details-marker]:hidden">
            <span className="flex-1">{item.q}</span>
            <ChevronDown
              className="size-4 shrink-0 text-fg-muted transition-transform group-open:rotate-180"
              aria-hidden="true"
            />
          </summary>
          <p className="pb-5 text-[14px] leading-relaxed text-fg-muted">{item.a}</p>
        </details>
      ))}
    </div>
  );
}

/** Données structurées FAQPage (JSON-LD) ; bloc de données, jamais exécuté. */
export function faqJsonLd(items: readonly FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.q,
      acceptedAnswer: { "@type": "Answer", text: i.a },
    })),
  };
}
