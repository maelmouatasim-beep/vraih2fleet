/**
 * Aperçu d'une pièce PDF rendu par pdf.js (canvas) — indépendant du
 * lecteur PDF du navigateur, pour comparer chaque valeur au document.
 */
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

const PAGES_MAX = 4;

export default function PdfApercu({ url }: { url: string }) {
  const { t } = useTranslation();
  const conteneur = useRef<HTMLDivElement>(null);
  const [etat, setEtat] = useState<"chargement" | "pret" | "erreur">("chargement");

  useEffect(() => {
    let annule = false;
    const cible = conteneur.current;
    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        const donnees = new Uint8Array(await (await fetch(url)).arrayBuffer());
        const doc = await pdfjs.getDocument({ data: donnees }).promise;
        if (annule || !cible) return;
        cible.replaceChildren();
        const largeur = Math.max(cible.clientWidth - 16, 320);
        for (let p = 1; p <= Math.min(doc.numPages, PAGES_MAX); p++) {
          const page = await doc.getPage(p);
          const base = page.getViewport({ scale: 1 });
          const vue = page.getViewport({ scale: (largeur / base.width) * (window.devicePixelRatio || 1) });
          const canvas = document.createElement("canvas");
          canvas.width = vue.width;
          canvas.height = vue.height;
          canvas.style.width = `${largeur}px`;
          canvas.className = "mx-auto mb-2 bg-white shadow-sm";
          await page.render({ canvasContext: canvas.getContext("2d")!, viewport: vue }).promise;
          if (annule) return;
          cible.appendChild(canvas);
        }
        setEtat("pret");
      } catch {
        if (!annule) setEtat("erreur");
      }
    })();
    return () => {
      annule = true;
    };
  }, [url]);

  return (
    <div className="relative max-h-[70vh] overflow-y-auto p-2">
      {etat === "chargement" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-4">
          <Loader2 className="w-4 h-4 animate-spin" /> {t("documents.previewLoading")}
        </div>
      )}
      {etat === "erreur" && <p className="text-sm text-muted-foreground p-4">{t("documents.previewError")}</p>}
      <div ref={conteneur} />
    </div>
  );
}
