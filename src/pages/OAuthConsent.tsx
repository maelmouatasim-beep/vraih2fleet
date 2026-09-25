import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ShieldCheck, XCircle } from "lucide-react";

// Minimal typed wrapper — `supabase.auth.oauth` is beta and not in the shipped types.
type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: any }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: any }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: any }>;
};

function oauthApi(): OAuthNamespace {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.auth as any).oauth as OAuthNamespace;
}

function safeSameOriginPath(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

// Cible de redirection sûre : chemin interne (safeSameOriginPath) ou URL
// https absolue (le retour OAuth vers le client est externe par design) —
// jamais javascript:, data:, http:.
function safeRedirectTarget(value: string | null | undefined): string | null {
  if (!value) return null;
  const internal = safeSameOriginPath(value);
  if (internal) return internal;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) {
        setError("Missing authorization_id in the URL.");
        return;
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next =
          safeSameOriginPath(window.location.pathname + window.location.search) ?? "/";
        window.location.href = "/login?next=" + encodeURIComponent(next);
        return;
      }
      try {
        const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
        if (!active) return;
        if (error) {
          setError(error.message ?? "Could not load this authorization request.");
          return;
        }
        const immediate = safeRedirectTarget(data?.redirect_url ?? data?.redirect_to);
        if (immediate && !data?.client) {
          window.location.href = immediate;
          return;
        }
        setDetails(data);
      } catch (e: any) {
        if (!active) return;
        setError(e?.message ?? "Unexpected error.");
      }
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    try {
      const { data, error } = approve
        ? await oauthApi().approveAuthorization(authorizationId)
        : await oauthApi().denyAuthorization(authorizationId);
      if (error) {
        setBusy(false);
        setError(error.message ?? "Authorization action failed.");
        return;
      }
      const target = safeRedirectTarget(data?.redirect_url ?? data?.redirect_to);
      if (!target) {
        setBusy(false);
        setError("No redirect returned by the authorization server.");
        return;
      }
      window.location.href = target;
    } catch (e: any) {
      setBusy(false);
      setError(e?.message ?? "Unexpected error.");
    }
  }

  if (error) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-background">
        <Card className="max-w-md w-full border-destructive/40">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <XCircle className="w-5 h-5" />
              <CardTitle>Could not load this request</CardTitle>
            </div>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  if (!details) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading authorization request…
        </div>
      </main>
    );
  }

  const clientName = details.client?.name ?? details.client?.client_name ?? "an app";
  const redirectUri = details.client?.redirect_uri ?? details.redirect_uri;

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="max-w-lg w-full border-border/50 shadow-xl">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <div className="h-14 w-14 rounded-2xl gradient-hero flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Connect {clientName} to H2Fleet</CardTitle>
          <CardDescription>
            This lets <span className="font-medium">{clientName}</span> call H2Fleet's MCP tools as
            you. Your row-level security policies still apply — the app will only see the projects
            and data your account can see.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4 text-sm space-y-2">
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Client</span>
              <span className="font-medium">{clientName}</span>
            </div>
            {redirectUri && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Redirect URI</span>
                <span className="font-mono text-xs break-all text-right">{redirectUri}</span>
              </div>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            This does not bypass H2Fleet's permissions or backend policies. You can revoke access at
            any time.
          </p>

          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              disabled={busy}
              onClick={() => decide(false)}
            >
              Cancel connection
            </Button>
            <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
              {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Approve
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}

export { safeSameOriginPath, safeRedirectTarget };
