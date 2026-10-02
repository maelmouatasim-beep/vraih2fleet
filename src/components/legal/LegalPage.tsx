/**
 * Pages légales (Phase 4) : CGU, confidentialité (Loi 25), remboursement,
 * en français ET en anglais (i18n « legal.* »). Textes au stade de PROJET :
 * bandeau « à faire valider par un juriste » et éléments entre crochets à
 * confirmer par l'exploitant — aucun nom légal, adresse ou délai inventé.
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

export type DocumentLegal = "terms" | "privacy" | "refund";

interface SectionLegale {
  title: string;
  paras: string[];
  items?: string[];
}

const LIENS: Record<DocumentLegal, string> = { terms: "/terms", privacy: "/privacy", refund: "/refund" };

export default function LegalPage({ document: doc }: { document: DocumentLegal }) {
  const { t } = useTranslation();
  const sections = t(`legal.${doc}.sections`, { returnObjects: true }) as SectionLegale[];

  useEffect(() => {
    window.document.title = `${t(`legal.${doc}.title`)} | H2Fleet`;
  }, [doc, t]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 pt-24 pb-12 max-w-3xl space-y-6">
        <Link to="/">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" /> {t("legal.back")}
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">{t(`legal.${doc}.title`)}</h1>
        <p className="text-sm text-muted-foreground">{t("legal.updated")}</p>
        <div
          role="note"
          className="flex gap-3 rounded-lg border border-amber-400/60 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
          <p>{t("legal.draftBanner")}</p>
        </div>
        {Array.isArray(sections) &&
          sections.map((s) => (
            <section key={s.title} className="space-y-2">
              <h2 className="text-xl font-semibold">{s.title}</h2>
              {s.paras.map((p, i) => (
                <p key={i} className="leading-relaxed text-foreground/90">
                  {p}
                </p>
              ))}
              {s.items && (
                <ul className="list-disc pl-6 space-y-1 text-foreground/90">
                  {s.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        <p className="text-sm text-muted-foreground pt-4 border-t border-border">
          {t("legal.seeAlso")} :{" "}
          {(Object.keys(LIENS) as DocumentLegal[])
            .filter((d) => d !== doc)
            .map((d, i) => (
              <span key={d}>
                {i > 0 && " · "}
                <Link to={LIENS[d]} className="text-primary underline">
                  {t(`legal.${d}.title`)}
                </Link>
              </span>
            ))}
        </p>
      </main>
      <Footer />
    </div>
  );
}
