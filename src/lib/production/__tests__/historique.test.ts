/**
 * Nettoyage de l'historique git (scripts/historique/nettoyer-courriel.sh),
 * testé sur un dépôt FACTICE avec une adresse fictive — jamais sur le vrai
 * dépôt. Requiert git-filter-repo (installé en CI par pipx) ; ignoré
 * localement s'il est absent.
 */
import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const SCRIPT = resolve(__dirname, "../../../../scripts/historique/nettoyer-courriel.sh");
const ANCIENNE = "personne.ficti" + "ve@exemple.test";
const NOUVELLE = "12345+fictif@users.noreply.github.com";
const filterRepo = spawnSync("git", ["filter-repo", "--version"]).status === 0;

function git(dossier: string, ...args: string[]) {
  return execFileSync("git", ["-C", dossier, ...args], {
    encoding: "utf8",
    env: { ...process.env, GIT_AUTHOR_NAME: "Fictif", GIT_COMMITTER_NAME: "Fictif", GIT_AUTHOR_EMAIL: ANCIENNE, GIT_COMMITTER_EMAIL: ANCIENNE },
  });
}

function depotFactice() {
  const racine = mkdtempSync(join(tmpdir(), "histo-"));
  const distant = join(racine, "distant.git");
  const local = join(racine, "local");
  execFileSync("git", ["init", "--quiet", "--bare", "-b", "principale", distant]);
  execFileSync("git", ["init", "--quiet", "-b", "principale", local]);
  writeFileSync(join(local, "constants.ts"), `export const ADMINS = ["${ANCIENNE}"];\n`);
  git(local, "add", ".");
  git(local, "commit", "--quiet", "-m", `ajout admin ${ANCIENNE}`);
  writeFileSync(join(local, "constants.ts"), "export const ADMINS: string[] = [];\n");
  git(local, "commit", "--quiet", "-am", "retrait de la liste");
  git(local, "checkout", "--quiet", "-b", "production");
  git(local, "remote", "add", "origin", distant);
  git(local, "push", "--quiet", "origin", "principale", "production");
  return { distant };
}

function lancer(distant: string, ...extra: string[]) {
  return spawnSync("bash", [SCRIPT, distant, ...extra], {
    encoding: "utf8",
    env: { ...process.env, ANCIENNE_ADRESSE: ANCIENNE, NOUVELLE_ADRESSE: NOUVELLE },
  });
}

const occurrences = (depot: string) => ({
  meta: git(depot, "log", "--all", "--format=%ae %ce").split(ANCIENNE).length - 1,
  messages: git(depot, "log", "--all", "--format=%B").split(ANCIENNE).length - 1,
  contenu: git(depot, "rev-list", "--all").trim().split("\n")
    .filter((c) => spawnSync("git", ["-C", depot, "grep", "-qF", ANCIENNE, c]).status === 0).length,
});

describe.skipIf(!filterRepo)("historique git — retrait d'une adresse courriel", () => {
  it("simulation : comptes avant/après sans jamais afficher l'adresse, RIEN n'est poussé", () => {
    const { distant } = depotFactice();
    const r = lancer(distant);
    expect(r.status, r.stderr).toBe(0);
    expect(r.stdout).toContain("Avant : métadonnées 4 · fichiers (toutes versions) 1 · messages 1");
    expect(r.stdout).toContain("Après : métadonnées 0 · fichiers (toutes versions) 0 · messages 0");
    expect(r.stdout).toContain("rien n'a été poussé");
    expect(r.stdout + r.stderr).not.toContain(ANCIENNE);
    expect(occurrences(distant).meta).toBe(4);
  }, 60000);

  it("--pousser : toutes les branches réécrites, plus aucune occurrence", () => {
    const { distant } = depotFactice();
    const r = lancer(distant, "--pousser");
    expect(r.status, r.stderr).toBe(0);
    expect(occurrences(distant)).toEqual({ meta: 0, messages: 0, contenu: 0 });
    expect(git(distant, "log", "--all", "--format=%ae").trim().split("\n")).toEqual([NOUVELLE, NOUVELLE]);
    expect(git(distant, "for-each-ref", "--format=%(refname:short)", "refs/heads").trim().split("\n").sort()).toEqual(["principale", "production"]);
    expect(r.stdout + r.stderr).not.toContain(ANCIENNE);
  }, 60000);

  it("adresse absente de l'environnement : refus", () => {
    const r = spawnSync("bash", [SCRIPT, "/nulle/part"], { encoding: "utf8", env: { PATH: process.env.PATH } });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/ANCIENNE_ADRESSE/);
  });
});
