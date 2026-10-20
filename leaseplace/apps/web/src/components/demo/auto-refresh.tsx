"use client";

import { useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";

/** Compte à rebours jusqu'au prochain code TOTP, puis rafraîchit la page. */
export function TotpCountdown({ seconds }: { seconds: number }) {
  const router = useRouter();
  const [left, setLeft] = useState(seconds);
  useEffect(() => {
    setLeft(seconds);
    const id = window.setInterval(() => {
      setLeft((s) => {
        if (s <= 1) {
          router.refresh();
          return 30;
        }
        return s - 1;
      });
    }, 1000);
    return () => {
      window.clearInterval(id);
    };
  }, [seconds, router]);
  return (
    <span
      className="tabular inline-block w-7 text-end font-mono text-[11px] text-fg-subtle"
      aria-hidden="true"
    >
      {left}s
    </span>
  );
}
