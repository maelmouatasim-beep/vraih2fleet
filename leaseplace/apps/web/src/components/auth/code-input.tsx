"use client";

import { Input } from "@leaseplace/ui/input";
import type { ComponentProps } from "react";

/** Saisie d'un code à 6 chiffres (TOTP ou courriel) : clavier numérique, autocomplétion OTP. */
export function CodeInput({
  focusOnMount = false,
  ...props
}: Omit<ComponentProps<typeof Input>, "type"> & { focusOnMount?: boolean }) {
  return (
    <Input
      // Focus au changement d'étape (après une action de l'utilisateur), jamais au chargement de la page.
      ref={
        focusOnMount
          ? (el) => {
              el?.focus();
            }
          : undefined
      }
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]{6}"
      maxLength={6}
      dir="ltr"
      className="tabular h-12 text-center font-mono text-xl tracking-[0.5em]"
      {...props}
    />
  );
}
