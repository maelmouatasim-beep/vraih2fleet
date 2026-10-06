/**
 * Lisibilité des sources officielles par la veille (correctif du
 * 2026-10-06) : la veille note, pour chaque source, si elle a pu la lire
 * (et comment) ou pourquoi elle a échoué. La Bibliothèque affiche
 * « vérification manuelle requise » quand la DERNIÈRE lecture de la page
 * d'un programme a échoué, avec le lien et ce qu'il faut lire soi-même.
 *
 * Module PUR, sans import : utilisé par l'application et par le script du
 * workflow (data/veille/lisibilite.json).
 */

export interface LectureSource {
  url: string;
  /** Date de la lecture (AAAA-MM-JJ). */
  date: string;
  lu: boolean;
  /** « requete » (lecture simple) ou « navigateur » (Chromium, repli). */
  mode?: "requete" | "navigateur";
  /** Raison de l'échec, courte (première ligne, 160 caractères au plus). */
  erreur?: string;
}

export interface Lisibilite {
  sources: Record<string, LectureSource>;
}

/** Première ligne d'un message d'erreur, sans bannière ni pile, 160 caractères au plus. */
export function erreurCourte(erreur: string): string {
  const ligne = erreur.split("\n").map((l) => l.trim()).find(Boolean) ?? "";
  return ligne.length > 160 ? `${ligne.slice(0, 157)}…` : ligne;
}

export function enregistrerLecture(l: Lisibilite, cle: string, lecture: LectureSource): Lisibilite {
  const propre: LectureSource = lecture.erreur ? { ...lecture, erreur: erreurCourte(lecture.erreur) } : lecture;
  return { sources: { ...l.sources, [cle]: propre } };
}

export type EtatLecture =
  | { etat: "lue"; date: string; mode: "requete" | "navigateur" }
  | { etat: "manuelle"; date: string; erreur: string }
  /** Jamais relue à cette adresse (nouvelle source ou adresse changée). */
  | { etat: "jamais" };

/**
 * État de lecture de la page d'un programme. Une lecture faite à une AUTRE
 * adresse que celle du registre ne compte pas (la source a changé depuis).
 */
export function etatLecture(programmeId: string, url: string, l: Lisibilite | null | undefined): EtatLecture {
  const s = l?.sources[programmeId];
  if (!s || s.url !== url) return { etat: "jamais" };
  if (s.lu) return { etat: "lue", date: s.date, mode: s.mode ?? "requete" };
  return { etat: "manuelle", date: s.date, erreur: s.erreur ?? "" };
}
