import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Truck, ArrowLeft, Eye, EyeOff, Check, X, Leaf } from 'lucide-react';
import { createSignupSchema } from '@/lib/validation/signupSchema';
import { cleErreurAuth } from '@/lib/authErrors';

// Inscription minimale : nom, email, mot de passe. Le profil (fonction,
// entreprise, flotte) se complète après la première connexion via
// ProfileOnboardingDialog — la flotte se décrit dans le parcours projet,
// pas à la création du compte.
export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signUp } = useAuth();
  const [courrielEnvoye, setCourrielEnvoye] = useState<string | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation();

  // Preserve ?next=/path so users returning from OAuth consent land back on it.
  const nextParam = new URLSearchParams(location.search).get('next');
  const safeNext = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null;
  const postAuthTarget = safeNext ?? '/dashboard';

  const signupSchema = createSignupSchema(t);

  const [formData, setFormData] = useState({ fullName: '', email: '', password: '', orgType: 'municipalite' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const passwordChecks = {
    minLength: formData.password.length >= 8,
    hasUppercase: /[A-Z]/.test(formData.password),
    hasNumber: /[0-9]/.test(formData.password),
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    const result = signupSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    setIsLoading(true);
    try {
      const { error, confirmationRequise } = await signUp(formData.email, formData.password, {
        full_name: formData.fullName.trim(),
        org_type: formData.orgType,
      });
      if (error) {
        const cle = cleErreurAuth(error);
        if (cle === 'auth.errors.codes.emailInUse') {
          setErrors({ email: t('auth.errors.emailInUse') });
        } else {
          toast({ title: t('common.error'), description: t(cle), variant: 'destructive' });
        }
      } else if (confirmationRequise) {
        setCourrielEnvoye(formData.email);
      } else {
        toast({ title: t('auth.signup.success'), description: t('auth.signup.welcomeMessage') });
        navigate(postAuthTarget);
      }
    } catch {
      toast({ title: t('common.error'), description: t('auth.errors.accountCreationError'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-2/5 gradient-hero relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-20 right-10 w-72 h-72 bg-primary-foreground/10 rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-10 w-96 h-96 bg-primary-foreground/5 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-12">
          <Link to="/" className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
              <Leaf className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-primary-foreground">H2Fleet</span>
          </Link>
          <h1 className="text-4xl font-bold text-primary-foreground mb-4">{t('auth.signup.branding.title')}</h1>
          <p className="text-lg text-primary-foreground/80 max-w-md mb-8">{t('auth.signup.branding.subtitle')}</p>
          <div className="space-y-4">
            {(['feature1', 'feature2', 'feature3', 'feature4'] as const).map((key) => (
              <div key={key} className="flex items-center gap-3 text-primary-foreground/80">
                <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                  <Check className="w-4 h-4 text-primary-foreground" />
                </div>
                <span>{t(`auth.signup.branding.${key}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right side - Minimal form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background overflow-y-auto">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            {t('common.backToHome')}
          </Link>
          <Card className="border-border/50 shadow-xl">
            <CardHeader className="text-center pb-2">
              <div className="lg:hidden flex justify-center mb-4">
                <div className="h-12 w-12 rounded-xl gradient-hero flex items-center justify-center">
                  <Truck className="h-6 w-6 text-primary-foreground" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold">{t('auth.signup.title')}</CardTitle>
              <CardDescription className="text-base">{t('auth.signup.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent>
              {courrielEnvoye ? (
                <div className="space-y-2 rounded-md border border-border bg-muted/40 p-4 text-sm" data-testid="signup-confirmation" role="status">
                  <p className="font-semibold">{t('auth.signup.confirmTitle')}</p>
                  <p className="text-muted-foreground">{t('auth.signup.confirmMessage', { email: courrielEnvoye })}</p>
                </div>
              ) : (
              <form onSubmit={handleSubmit} className="space-y-5 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="fullName">{t('auth.fields.fullName')}</Label>
                  <Input
                    id="fullName"
                    autoComplete="name"
                    placeholder={t('auth.placeholders.fullName')}
                    value={formData.fullName}
                    onChange={(e) => setFormData((prev) => ({ ...prev, fullName: e.target.value }))}
                    className={errors.fullName ? 'border-destructive' : ''}
                    disabled={isLoading}
                  />
                  {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="orgType">{t('auth.fields.orgType')}</Label>
                  <select
                    id="orgType"
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={formData.orgType}
                    onChange={(e) => setFormData((prev) => ({ ...prev, orgType: e.target.value }))}
                    disabled={isLoading}
                  >
                    <option value="municipalite">{t('organization.types.municipalite')}</option>
                    <option value="societe_transport">{t('organization.types.societe_transport')}</option>
                    <option value="entreprise">{t('organization.types.entreprise')}</option>
                  </select>
                  <p className="text-xs text-muted-foreground">{t('auth.fields.orgTypeHint')}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">{t('auth.fields.professionalEmail')}</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder={t('auth.placeholders.professionalEmail')}
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    className={errors.email ? 'border-destructive' : ''}
                    disabled={isLoading}
                  />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">{t('auth.fields.password')}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                      className={`pr-10 ${errors.password ? 'border-destructive' : ''}`}
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {formData.password.length > 0 && (
                    <div className="space-y-1 text-xs pt-1">
                      <div className={`flex items-center gap-1 ${passwordChecks.minLength ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {passwordChecks.minLength ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        {t('auth.validation.minChars')}
                      </div>
                      <div className={`flex items-center gap-1 ${passwordChecks.hasUppercase ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {passwordChecks.hasUppercase ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        {t('auth.validation.uppercase')}
                      </div>
                      <div className={`flex items-center gap-1 ${passwordChecks.hasNumber ? 'text-green-600' : 'text-muted-foreground'}`}>
                        {passwordChecks.hasNumber ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                        {t('auth.validation.digit')}
                      </div>
                    </div>
                  )}
                </div>

                <Button type="submit" className="w-full h-12 text-base" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('auth.signup.creating')}
                    </>
                  ) : (
                    t('auth.signup.createButton')
                  )}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  {t('auth.login.alreadyHaveAccount')}{' '}
                  <Link to="/login" className="text-primary hover:underline font-medium">
                    {t('auth.login.signInButton')}
                  </Link>
                </p>
              </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
