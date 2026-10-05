/**
 * Paramètres › courriel de test (administrateurs H2Fleet seulement) :
 * vérifie l'envoi par SMTP (IONOS) vers une adresse saisie et affiche un
 * résultat clair (envoyé, non branché, identifiant refusé, connexion…).
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, MailCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/layout/States";
import { adresseValide, issueCourrielTest, type IssueCourrielTest } from "@/lib/courriels/courrielTest";

async function envoyer(to: string): Promise<IssueCourrielTest> {
  const { error } = await supabase.functions.invoke("send-email", { body: { templateType: "test_email", data: { to } } });
  if (!error) return "envoye";
  const reponse = (error as { context?: unknown }).context;
  if (!(reponse instanceof Response)) return "echec";
  let corps: unknown = null;
  try {
    corps = await reponse.clone().json();
  } catch {
    /* corps non JSON */
  }
  return issueCourrielTest(reponse.status, corps);
}

export default function CourrielTest() {
  const { t } = useTranslation();
  const [adresse, setAdresse] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [issue, setIssue] = useState<IssueCourrielTest | null>(null);
  const [adresseInvalide, setAdresseInvalide] = useState(false);

  const soumettre = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adresseValide(adresse)) {
      setAdresseInvalide(true);
      return;
    }
    setAdresseInvalide(false);
    setEnvoi(true);
    setIssue(null);
    setIssue(await envoyer(adresse.trim()));
    setEnvoi(false);
  };

  return (
    <form onSubmit={soumettre} className="space-y-2" data-testid="test-email">
      <Label htmlFor="test-email-to" className="flex items-center gap-2">
        <MailCheck className="h-4 w-4 text-primary" />
        {t("pages.settings.emailNotifications.test.title")}
      </Label>
      <p className="text-sm text-muted-foreground">{t("pages.settings.emailNotifications.test.desc")}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id="test-email-to"
          type="email"
          autoComplete="off"
          value={adresse}
          onChange={(e) => setAdresse(e.target.value)}
          placeholder={t("auth.placeholders.email")}
          data-testid="test-email-to"
        />
        <Button type="submit" disabled={envoi} className="shrink-0" data-testid="test-email-send">
          {envoi && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("pages.settings.emailNotifications.test.send")}
        </Button>
      </div>
      {adresseInvalide && <p className="text-sm text-destructive">{t("auth.validation.invalidEmail")}</p>}
      {issue && (
        <div className="flex items-start gap-2 text-sm" role="status" data-testid="test-email-result" data-issue={issue}>
          <StatusBadge ton={issue === "envoye" ? "succes" : issue === "non_configure" ? "attention" : "danger"}>
            {t(`pages.settings.emailNotifications.test.badge.${issue === "envoye" ? "ok" : issue === "non_configure" ? "off" : "ko"}`)}
          </StatusBadge>
          <span>{t(`pages.settings.emailNotifications.test.result.${issue}`)}</span>
        </div>
      )}
    </form>
  );
}
