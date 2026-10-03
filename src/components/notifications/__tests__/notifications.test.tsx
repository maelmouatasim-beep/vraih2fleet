// @vitest-environment happy-dom
/**
 * Cloche des notifications : chaque type (et un type inconnu) se rend sans
 * planter, le clic mène au bon écran, le compteur est celui de la source
 * partagée, et une erreur de rendu reste confinée (barrière d'erreur).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import i18next from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import fr from "@/i18n/locales/fr/translation.json";
import en from "@/i18n/locales/en/translation.json";
import { NOTIFICATION_TYPES, type NotificationRow } from "@/lib/notifications/model";

vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "moi" } }) }));

const etat = {
  notifications: [] as NotificationRow[],
  unreadCount: 0,
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
  markAsRead: vi.fn(async () => {}),
  markAllAsRead: vi.fn(async () => {}),
  archive: vi.fn(async () => {}),
};
vi.mock("@/hooks/useNotifications", () => ({ useNotifications: () => etat }));

const { NotificationItem } = await import("../NotificationItem");
const { NotificationsDropdown } = await import("../NotificationsDropdown");
const { NotificationsBoundary } = await import("../NotificationsBoundary");
const { apparenceNotification } = await import("../appearance");

const i18n = i18next.createInstance();
beforeAll(async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  await i18n.use(initReactI18next).init({
    lng: "fr",
    resources: { fr: { translation: fr }, en: { translation: en } },
    interpolation: { escapeValue: false },
  });
});

const PROJET = "11111111-2222-3333-4444-555555555555";
const notif = (type: string, extra: Partial<NotificationRow> = {}): NotificationRow => ({
  id: `n-${type}`,
  user_id: "moi",
  type,
  title: `Titre ${type}`,
  message: `Message ${type}`,
  project_id: PROJET,
  related_id: "r1",
  actor_id: null,
  is_read: false,
  created_at: new Date(Date.now() - 5 * 60_000).toISOString(),
  archived_at: null,
  payload: { v: 1, project: "Ville de Rivière-Claire", subject: "Remplacer U-12", count: 4, kind: "echeance_subvention", title_fr: "Échéance PAVÉ", title_en: "PAVÉ deadline", message_fr: "Dans 30 jours", message_en: "In 30 days" },
  ...extra,
});

let racine: Root | null = null;
let conteneur: HTMLDivElement | null = null;
afterEach(() => {
  act(() => racine?.unmount());
  conteneur?.remove();
  document.body.innerHTML = "";
  racine = null;
  vi.clearAllMocks();
});

function monter(element: React.ReactNode) {
  conteneur = document.createElement("div");
  document.body.appendChild(conteneur);
  racine = createRoot(conteneur);
  act(() => racine!.render(<I18nextProvider i18n={i18n}>{element}</I18nextProvider>));
}

function Emplacement() {
  const l = useLocation();
  return <output data-testid="emplacement">{l.pathname + l.search}</output>;
}

describe("NotificationItem", () => {
  it("rend CHAQUE type autorisé par la base, plus un type inconnu, sans planter (fr et en)", async () => {
    for (const langue of ["fr", "en"]) {
      await i18n.changeLanguage(langue);
      for (const type of [...NOTIFICATION_TYPES, "type_futur"]) {
        const html = renderToStaticMarkup(
          <I18nextProvider i18n={i18n}>
            <NotificationItem notification={notif(type)} onClick={() => {}} onArchive={() => {}} />
          </I18nextProvider>,
        );
        expect(html, `${langue}/${type}`).toContain(`data-type="${type}"`);
        expect(html).toContain("<svg");
        expect(html).not.toMatch(/notifications\.kinds|\{\{/);
      }
    }
    await i18n.changeLanguage("fr");
  });

  it("une icône définie pour tout type, cloche par défaut pour un type inconnu", () => {
    for (const type of [...NOTIFICATION_TYPES, "type_futur", ""]) {
      expect(apparenceNotification(notif(type)).icone, type).toBeTruthy();
    }
  });

  it("date relative dans la langue de l'interface", async () => {
    const rendu = () =>
      renderToStaticMarkup(
        <I18nextProvider i18n={i18n}>
          <NotificationItem notification={notif("comment")} onClick={() => {}} />
        </I18nextProvider>,
      );
    await i18n.changeLanguage("fr");
    expect(rendu()).toMatch(/il y a 5 minutes/);
    await i18n.changeLanguage("en");
    expect(rendu()).toMatch(/5 minutes ago/);
    await i18n.changeLanguage("fr-CA");
    expect(rendu()).toMatch(/il y a 5 minutes/);
    await i18n.changeLanguage("fr");
  });
});

describe("NotificationsDropdown (cloche)", () => {
  function ouvrirCloche() {
    const cloche = document.querySelector<HTMLButtonElement>('[data-testid="notifications-bell"]')!;
    act(() => cloche.click());
    return document.querySelector('[data-testid="notifications-panel"]');
  }

  it("ouvre la liste avec plusieurs types, compteur = source partagée, clic → étape Suivi + marquée lue", () => {
    etat.notifications = [notif("task_assigned"), notif("plan_alert"), notif("milestone_assigned"), notif("collaboration_accepted")];
    etat.unreadCount = 4;
    monter(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="*" element={<><NotificationsDropdown /><Emplacement /></>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(document.querySelector('[data-testid="notifications-badge"]')?.textContent).toBe("4");
    const panneau = ouvrirCloche();
    expect(panneau).not.toBeNull();
    const items = document.querySelectorAll('[data-testid="notification-item"]');
    expect(items).toHaveLength(4);
    expect(document.body.textContent).toContain("Nouvelle tâche assignée");
    expect(document.body.textContent).toContain("Échéance PAVÉ");

    act(() => items[0].querySelector("button")!.click());
    expect(etat.markAsRead).toHaveBeenCalledWith("n-task_assigned");
    expect(document.querySelector('[data-testid="emplacement"]')?.textContent).toBe(`/dashboard/projects/${PROJET}/suivi`);
  });

  it("alerte d'échéance de subvention → Financement ; archiver ne navigue pas", () => {
    etat.notifications = [notif("plan_alert", { is_read: true })];
    etat.unreadCount = 0;
    monter(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <Routes>
          <Route path="*" element={<><NotificationsDropdown /><Emplacement /></>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(document.querySelector('[data-testid="notifications-badge"]')).toBeNull();
    ouvrirCloche();
    act(() => document.querySelector<HTMLButtonElement>('[data-testid="notification-archive"]')!.click());
    expect(etat.archive).toHaveBeenCalledWith("n-plan_alert");
    expect(document.querySelector('[data-testid="emplacement"]')?.textContent).toBe("/dashboard");
    act(() => document.querySelector('[data-testid="notification-item"] button')!.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(etat.markAsRead).not.toHaveBeenCalled(); // déjà lue
    expect(document.querySelector('[data-testid="emplacement"]')?.textContent).toBe(`/dashboard/projects/${PROJET}/financement`);
  });

  it("états propres : liste vide, erreur réseau avec « Réessayer »", () => {
    etat.notifications = [];
    etat.unreadCount = 0;
    monter(
      <MemoryRouter>
        <NotificationsDropdown />
      </MemoryRouter>,
    );
    ouvrirCloche();
    expect(document.querySelector('[data-testid="notifications-empty"]')).not.toBeNull();
    act(() => racine?.unmount());
    document.body.innerHTML = "";

    etat.isError = true;
    monter(
      <MemoryRouter>
        <NotificationsDropdown />
      </MemoryRouter>,
    );
    ouvrirCloche();
    const erreur = document.querySelector('[data-testid="notifications-error"]');
    expect(erreur?.textContent).toContain("Impossible de charger les notifications");
    act(() => erreur!.querySelector("button")!.click());
    expect(etat.refetch).toHaveBeenCalled();
    etat.isError = false;
  });
});

describe("NotificationsBoundary", () => {
  it("une erreur de rendu affiche une cloche « indisponible » au lieu de planter la page", () => {
    const console_ = vi.spyOn(console, "error").mockImplementation(() => {});
    const Casse = () => {
      throw new Error("boum");
    };
    monter(
      <div>
        <span data-testid="reste-de-la-page">page</span>
        <NotificationsBoundary>
          <Casse />
        </NotificationsBoundary>
      </div>,
    );
    expect(document.querySelector('[data-testid="reste-de-la-page"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="notifications-unavailable"]')).not.toBeNull();
    console_.mockRestore();
  });
});
