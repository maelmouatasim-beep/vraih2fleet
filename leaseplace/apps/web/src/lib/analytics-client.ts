"use client";

import { useEffect, useRef } from "react";
import { amountBand, type AnalyticsEvent, type PUBLIC_PAGES } from "@leaseplace/domain";

/**
 * Événements des pages publiques, envoyés au serveur de LeasePlace (même
 * origine) qui les transmet sous pseudonyme : aucun script ni cookie tiers.
 * Identifiant aléatoire limité à l'onglet (sessionStorage) ; rien n'est
 * envoyé si le navigateur demande de ne pas être suivi (DNT, GPC).
 */
function optedOut(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  return nav.doNotTrack === "1" || nav.globalPrivacyControl === true;
}

function tabId(): string {
  const random = () =>
    Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("");
  try {
    const existing = sessionStorage.getItem("lp.tab");
    if (existing && /^[0-9a-f]{32}$/.test(existing)) return existing;
    const id = random();
    sessionStorage.setItem("lp.tab", id);
    return id;
  } catch {
    return random();
  }
}

export function sendEvent(
  event: Extract<AnalyticsEvent, "page_viewed" | "simulator_used">,
  properties: Record<string, string | number>,
): void {
  if (typeof navigator === "undefined" || optedOut()) return;
  const body = JSON.stringify({ event, id: tabId(), properties });
  if (!navigator.sendBeacon("/api/evenements", body))
    void fetch("/api/evenements", { method: "POST", body, keepalive: true }).catch(() => undefined);
}

export function publicPageOf(pathname: string): (typeof PUBLIC_PAGES)[number] | null {
  if (pathname === "/") return "landing";
  if (pathname.startsWith("/simulateur")) return "simulator";
  if (pathname.startsWith("/secteurs/")) return "sector";
  if (pathname.startsWith("/bailleurs")) return "lessors";
  if (pathname.startsWith("/mentions-legales")) return "legal";
  return null;
}

/** Simulateur utilisé : une fois par affichage, après la première modification stabilisée. */
export function useSimulatorTracking(params: { amount: number; months: number }): void {
  const initial = useRef(params);
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || params === initial.current) return;
    const timer = window.setTimeout(() => {
      sent.current = true;
      sendEvent("simulator_used", {
        amount_band: amountBand(params.amount),
        duration_months: params.months,
      });
    }, 1500);
    return () => {
      window.clearTimeout(timer);
    };
  }, [params]);
}
