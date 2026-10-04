import { useState } from "react";
import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { Leaf, Mail, Loader2, ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { cleErreurAuth } from "@/lib/authErrors";
import { z } from "zod";
import { urlRetourAuth } from "@/lib/authRedirect";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState("");
  const { t } = useTranslation();

  const emailSchema = z.object({
    email: z.string().email(t('auth.validation.invalidEmail')),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    const result = emailSchema.safeParse({ email });
    if (!result.success) {
      setError(result.error.errors[0].message);
      return;
    }
    
    setIsLoading(true);
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: urlRetourAuth("/reset-password"),
    });
    
    if (error) {
      toast({
        title: t('common.error'),
        description: t(cleErreurAuth(error)),
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
    
    setIsSuccess(true);
    setIsLoading(false);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-background">
        <Card className="w-full max-w-md border-0 shadow-xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">{t('auth.forgotPassword.successTitle')}</CardTitle>
            <CardDescription className="text-base">
              {/* XSS : l'email est interpolé par React (échappé), le <strong>
                  vient du gabarit de traduction via <Trans>. */}
              <Trans
                i18nKey="auth.forgotPassword.successMessage"
                values={{ email }}
                components={{ strong: <strong /> }}
              />
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Link to="/login">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                {t('auth.forgotPassword.backToLogin')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="w-full max-w-md">
        <Link 
          to="/login" 
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('auth.forgotPassword.backToLogin')}
        </Link>
        
        <Card className="border-0 shadow-xl">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-xl gradient-hero flex items-center justify-center">
                <Leaf className="w-6 h-6 text-primary-foreground" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">{t('auth.forgotPassword.title')}</CardTitle>
            <CardDescription>
              {t('auth.forgotPassword.subtitle')}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.fields.email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder={t('auth.placeholders.email')}
                    className={`pl-9 ${error ? "border-destructive" : ""}`}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
                {error && (
                  <p className="text-sm text-destructive">{error}</p>
                )}
              </div>
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('auth.forgotPassword.sending')}
                  </>
                ) : (
                  t('auth.forgotPassword.sendLink')
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;
