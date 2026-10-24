"use client";

import { ArrowLeft, Building2, Landmark, Mail, MailCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import * as Tabs from "@radix-ui/react-tabs";
import { useState } from "react";
import { Alert } from "@leaseplace/ui/alert";
import { Button } from "@leaseplace/ui/button";
import { Input } from "@leaseplace/ui/input";
import { getPathname, Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { authClient } from "@/lib/auth-client";
import { CodeInput } from "./code-input";
import { Field, FormError } from "./form-bits";

type ErrorLike = { status?: number } | null | undefined;

function useErrorMessage() {
  const t = useTranslations("auth.errors");
  return (error: ErrorLike, fallback: "credentials" | "code" = "credentials") => {
    if (!error) return null;
    if (error.status === 429) return t("tooMany");
    if (error.status === 400 || error.status === 401 || error.status === 403) return t(fallback);
    return t("generic");
  };
}

function useGoTo() {
  const locale = useLocale() as Locale;
  return (href: string) => {
    // Rechargement complet : les composants serveur relisent la session.
    window.location.assign(getPathname({ href, locale }));
  };
}

function CompanySignIn({ next, demo }: { next: string; demo: boolean }) {
  const t = useTranslations("auth");
  const locale = useLocale() as Locale;
  const errorOf = useErrorMessage();
  const goTo = useGoTo();
  const [step, setStep] = useState<"email" | "code" | "link">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const sendCode = async () => {
    setPending(true);
    setError(null);
    const { error: e } = await authClient.emailOtp.sendVerificationOtp({ email, type: "sign-in" });
    setPending(false);
    if (e) {
      setError(errorOf(e));
      return;
    }
    setStep("code");
  };

  const sendLink = async () => {
    setPending(true);
    setError(null);
    const { error: e } = await authClient.signIn.magicLink({
      email,
      callbackURL: getPathname({ href: next, locale }),
    });
    setPending(false);
    if (e) {
      setError(errorOf(e));
      return;
    }
    setStep("link");
  };

  const verify = async () => {
    setPending(true);
    setError(null);
    const { error: e } = await authClient.signIn.emailOtp({ email, otp: code });
    setPending(false);
    if (e) {
      setError(errorOf(e, "code"));
      return;
    }
    goTo(next);
  };

  const outboxLink = demo ? (
    <Link href="/demo/boite-mail" className="font-medium text-primary underline underline-offset-2">
      {t("demoOutbox")}
    </Link>
  ) : null;

  if (step === "link") {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success">
          <MailCheck aria-hidden="true" />
          <span>{t("linkSent", { email })}</span>
        </Alert>
        {outboxLink ? <p className="text-sm text-fg-muted">{outboxLink}</p> : null}
        <Button
          variant="ghost"
          onClick={() => {
            setStep("email");
          }}
          className="self-start"
        >
          <ArrowLeft className="rtl:rotate-180" aria-hidden="true" />
          {t("changeEmail")}
        </Button>
      </div>
    );
  }

  if (step === "code") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
        className="flex flex-col gap-4"
      >
        <p className="text-sm text-fg-muted">{t("codeSent", { email })}</p>
        <Field id="code-entreprise" label={t("codeLabel")} hint={outboxLink}>
          <CodeInput
            id="code-entreprise"
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
          {t("signIn")}
        </Button>
        <div className="flex justify-between text-sm">
          <Button
            type="button"
            variant="link"
            onClick={() => {
              setStep("email");
              setCode("");
            }}
          >
            {t("changeEmail")}
          </Button>
          <Button
            type="button"
            variant="link"
            disabled={pending}
            onClick={() => {
              void sendCode();
            }}
          >
            {t("resend")}
          </Button>
        </div>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void sendCode();
      }}
      className="flex flex-col gap-4"
    >
      <Field id="email-entreprise" label={t("emailLabel")}>
        <Input
          id="email-entreprise"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value.trim());
          }}
          placeholder={t("emailPlaceholder")}
        />
      </Field>
      <FormError message={error} />
      <Button type="submit" size="lg" disabled={pending || !email}>
        {t("sendCode")}
      </Button>
      <Button
        type="button"
        variant="secondary"
        size="lg"
        disabled={pending || !email}
        onClick={() => {
          void sendLink();
        }}
      >
        <Mail aria-hidden="true" />
        {t("sendLink")}
      </Button>
      <p className="text-xs text-fg-subtle">{t("companyHint")}</p>
      <p className="text-xs text-fg-subtle">{t("signupHint")}</p>
    </form>
  );
}

function ProSignIn({ next }: { next: string }) {
  const t = useTranslations("auth");
  const errorOf = useErrorMessage();
  const goTo = useGoTo();
  const [step, setStep] = useState<"password" | "totp">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const signIn = async () => {
    setPending(true);
    setError(null);
    const { data, error: e } = await authClient.signIn.email({ email, password });
    setPending(false);
    if (e) {
      setError(errorOf(e));
      return;
    }
    if ("twoFactorRedirect" in data && data.twoFactorRedirect) {
      setStep("totp");
      return;
    }
    goTo(next);
  };

  const verify = async () => {
    setPending(true);
    setError(null);
    const { error: e } = await authClient.twoFactor.verifyTotp({ code });
    setPending(false);
    if (e) {
      setError(errorOf(e, "code"));
      return;
    }
    goTo(next);
  };

  if (step === "totp") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void verify();
        }}
        className="flex flex-col gap-4"
      >
        <p className="text-sm text-fg-muted">{t("totpPrompt")}</p>
        <Field id="code-totp" label={t("totpLabel")}>
          <CodeInput
            id="code-totp"
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
          {t("verify")}
        </Button>
      </form>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void signIn();
      }}
      className="flex flex-col gap-4"
    >
      <Field id="email-pro" label={t("emailProLabel")}>
        <Input
          id="email-pro"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value.trim());
          }}
        />
      </Field>
      <Field id="mot-de-passe" label={t("passwordLabel")}>
        <Input
          id="mot-de-passe"
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
      <Button type="submit" size="lg" disabled={pending || !email || !password}>
        {t("continue")}
      </Button>
      <p className="text-xs text-fg-subtle">{t("proHint")}</p>
    </form>
  );
}

const tabClass =
  "flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md text-[13px] font-medium text-fg-muted transition-colors data-[state=active]:bg-surface data-[state=active]:text-fg data-[state=active]:shadow-sm [&_svg]:size-3.5";

export function SignInForm({ next, demo }: { next: string; demo: boolean }) {
  const t = useTranslations("auth");
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg">{t("title")}</h1>
        <p className="mt-1 text-sm text-fg-muted">{t("subtitle")}</p>
      </div>
      <Tabs.Root defaultValue="company" className="flex flex-col gap-5">
        <Tabs.List
          aria-label={t("tabsLabel")}
          className="flex gap-1 rounded-lg bg-surface-sunken p-1"
        >
          <Tabs.Trigger value="company" className={tabClass}>
            <Building2 aria-hidden="true" />
            {t("tabCompany")}
          </Tabs.Trigger>
          <Tabs.Trigger value="pro" className={tabClass}>
            <Landmark aria-hidden="true" />
            {t("tabPro")}
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="company" className="outline-none">
          <CompanySignIn next={next} demo={demo} />
        </Tabs.Content>
        <Tabs.Content value="pro" className="outline-none">
          <ProSignIn next={next} />
        </Tabs.Content>
      </Tabs.Root>
      {demo ? (
        <p className="rounded-md border border-dashed border-accent/40 bg-accent-soft/50 px-3 py-2 text-[13px] text-accent-strong">
          {t("demoHint")}{" "}
          <Link href="/demo" className="font-medium underline underline-offset-2">
            {t("demoAccounts")}
          </Link>
        </p>
      ) : null}
    </div>
  );
}
