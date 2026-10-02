/**
 * Phase 5.4 — Couche texte d'une pièce PDF, lue dans le navigateur
 * (pdf.js) : MINIMISATION — quand elle existe, seul ce texte est transmis
 * à l'IA (et sert à retrouver chaque nombre extrait). Image ou PDF
 * numérisé sans texte : null (le fichier est alors transmis).
 */
export const PAGES_MAX_TEXTE = 20;

export async function lireTexteDocument(file: File): Promise<string | null> {
  if (file.type !== "application/pdf") return null;
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const pages: string[] = [];
  for (let p = 1; p <= Math.min(doc.numPages, PAGES_MAX_TEXTE); p++) {
    const contenu = await (await doc.getPage(p)).getTextContent();
    // Lignes reconstituées par ordonnée (lecture naturelle des montants).
    const lignes = new Map<number, { x: number; s: string }[]>();
    for (const item of contenu.items) {
      if (!("str" in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5]);
      const ligne = lignes.get(y) ?? [];
      ligne.push({ x: item.transform[4], s: item.str });
      lignes.set(y, ligne);
    }
    const texte = [...lignes.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, l]) => l.sort((a, b) => a.x - b.x).map((e) => e.s).join(" "))
      .join("\n");
    pages.push(`[page ${p}]\n${texte}`);
  }
  const tout = pages.join("\n\n").slice(0, 120_000);
  return tout.replace(/\[page \d+\]/g, "").trim().length >= 200 ? tout : null;
}
