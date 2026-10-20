"use client";

import { Copy, KeyRound, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import QRCode from "qrcode";
import { useState } from "react";
import { Alert } from "@leaseplace/ui/alert";
import { Button } from "@leaseplace/ui/button";
import { Input } from "@leaseplace/ui/input";
import { getPathname } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { authClient } from "@/lib/auth-client";
import { CodeInput } from "./code-input";
import { Field, FormError } from "./form-bits";

/** Secret base32 lisible extrait de l'URI otpauth (saisie manuelle). */
export function secretFromUri(uri: string): string {
  const secret = new URL(uri).searchParams.get("secret") ?? "";
  return secret.replace(/(.{4})/g, "$1 ").trim();
}

export function TwoFactorSetup() {
  const t = useTranslations("twoFactor");
  const tErr = useTranslations("auth.errors");
  const locale = useLocale() as Locale;
  const [step, setStep] = useState<"password" | "scan" | "codes">("password");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const enable = async () => {
    setPending(true);
    setError(null);
    const { data, error: e } = await authClient.twoFactor.enable({ password });
    setPending(false);
    if (e) {
      setError(e.status === 429 ? tErr("tooMany") : tErr("credentials"));
      return;
    }
    if (data.method !== "totp") {
      setError(tErr("generic"));
      return;
    }
    setQr(
      await QRCode.toDataURL(data.totpURI, { margin: 1, width: 192, errorCorrectionLevel: "M" }),
    );
    setSecret(secretFromUri(data.totpURI));
    setBackupCodes(data.backupCodes);
    setStep("scan");
  };

  const verify = async () => {
    setPending(true);
    setError(null);
    const { error: e } = await authClient.twoFactor.verifyTotp({ code });
    setPending(false);
    if (e) {
      setError(e.status === 429 ? tErr("tooMany") : tErr("code"));
      return;
    }
    setStep("codes");
  };

  if (step === "codes") {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success">
          <ShieldCheck aria-hidden="true" />
          <span>{t("enabled")}</span>
        </Alert>
        <div>
          <p className="text-sm font-medium text-fg">{t("backupTitle")}</p>
          <p className="mt-1 text-sm text-fg-muted">{t("backupBody")}</p>
        </div>
        <ul
          className="grid grid-cols-2 gap-2 rounded-md border border-border bg-surface-muted p-3 font-mono text-[13px]"
          dir="ltr"
        >
          {backupCodes.map((c) => (
            <li key={c} className="tabular">
              {c}
            </li>
          ))}
        </ul>
        <Button
          variant="secondary"
          onClick={() => {
            void navigator.clipboard.writeText(backupCodes.join("\n"));
          }}
        >
          <Copy aria-hidden="true" />
          {t("copyCodes")}
        </Button>
        <Button
          size="lg"
          onClick={() => {
            window.location.assign(getPathname({ href: "/espace", locale }));
          }}
        >
          {t("continue")}
        </Button>
      </div>
    );
  }

  if (step === "scan") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
        className="flex flex-col gap-4"
      >
        <p className="text-sm text-fg-muted">{t("scanBody")}</p>
        <div className="flex items-center gap-4 rounded-lg border border-border bg-surface p-4">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element -- QR généré localement (data:)
            <img
              src={qr}
              alt={t("qrAlt")}
              width={144}
              height={144}
              className="rounded-md bg-white p-1"
            />
          ) : null}
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-medium text-fg-muted">
              <KeyRound className="size-3.5" aria-hidden="true" />
              {t("manualKey")}
            </p>
            <p
              className="mt-1 font-mono text-[12px] break-all text-fg"
              dir="ltr"
              data-field="totp-secret"
            >
              {secret}
            </p>
          </div>
        </div>
        <Field id="code-enrolement" label={t("codeLabel")}>
          <CodeInput
            id="code-enrolement"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.replace(/\D/g, ""));
            }}
            required
            focusOnMount
          />
        </Field>
        <FormError message={error} />
        <Button type="submit" size="lg" disabled={pending || code.length !== 6}>
          {t("activate")}
        </Button>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void enable();
      }}
      className="flex flex-col gap-4"
    >
      <Field id="mot-de-passe-2fa" label={t("passwordLabel")}>
        <Input
          id="mot-de-passe-2fa"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
          }}
        />
      </Field>
      <FormError message={error} />
      <Button type="submit" size="lg" disabled={pending || !password}>
        {t("start")}
      </Button>
    </form>
  );
}
