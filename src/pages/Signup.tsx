import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

import { useToast } from '@/hooks/use-toast';
import { Loader2, Truck, ArrowLeft, Eye, EyeOff, Check, X, Leaf } from 'lucide-react';
import { z } from 'zod';

export default function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signUp } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  // Preserve ?next=/path so users returning from OAuth consent land back on it.
  const nextParam = new URLSearchParams(location.search).get('next');
  const safeNext = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : null;
  const postAuthTarget = safeNext ?? '/dashboard';


  const FUNCTION_TITLES = [
    { value: 'fleet_director', label: t('auth.signup.functionTitles.fleetDirector') },
    { value: 'transport_manager', label: t('auth.signup.functionTitles.transportManager') },
    { value: 'fleet_manager', label: t('auth.signup.functionTitles.fleetManager') },
    { value: 'operations_director', label: t('auth.signup.functionTitles.operationsDirector') },
    { value: 'other', label: t('auth.signup.functionTitles.other') },
  ];

  const FLEET_SIZES = [
    { value: 'less_than_10', label: t('auth.signup.fleetSizes.lessThan10') },
    { value: '10_50', label: t('auth.signup.fleetSizes.10to50') },
    { value: '50_200', label: t('auth.signup.fleetSizes.50to200') },
    { value: '200_500', label: t('auth.signup.fleetSizes.200to500') },
    { value: '500_plus', label: t('auth.signup.fleetSizes.500plus') },
  ];

  const FLEET_TYPES = [
    { id: 'heavy_trucks', label: t('auth.signup.fleetTypes.heavyTrucks') },
    { id: 'buses', label: t('auth.signup.fleetTypes.buses') },
    { id: 'light_commercial', label: t('auth.signup.fleetTypes.lightCommercial') },
    { id: 'passenger_vehicles', label: t('auth.signup.fleetTypes.passengerVehicles') },
    { id: 'other', label: t('auth.signup.fleetTypes.other') },
  ];

  const signupSchema = z.object({
    fullName: z.string().min(2, t('auth.validation.nameMinLength')),
    functionTitle: z.string().min(1, t('auth.validation.selectFunction')),
    company: z.string().min(2, t('auth.validation.companyMinLength')),
    email: z.string().email(t('auth.validation.invalidEmail')),
    fleetSize: z.string().min(1, t('auth.validation.selectFleetSize')),
    fleetTypes: z.array(z.string()).min(1, t('auth.validation.selectFleetType')),
    password: z
      .string()
      .min(8, t('auth.validation.passwordMinLength'))
      .regex(/[A-Z]/, t('auth.validation.passwordUppercase'))
      .regex(/[0-9]/, t('auth.validation.passwordDigit')),
    confirmPassword: z.string(),
    newsletterOptIn: z.boolean(),
  }).refine((data) => data.password === data.confirmPassword, {
    message: t('auth.validation.passwordMismatch'),
    path: ['confirmPassword'],
  });

  const [formData, setFormData] = useState({
    fullName: '', functionTitle: '', company: '', email: '',
    fleetSize: '', fleetTypes: [] as string[],
    password: '', confirmPassword: '', newsletterOptIn: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
      const { error } = await signUp(formData.email, formData.password, {
        full_name: formData.fullName, company: formData.company,
        function_title: formData.functionTitle, fleet_size: formData.fleetSize,
        fleet_types: formData.fleetTypes, newsletter_opt_in: formData.newsletterOptIn,
      });
      if (error) {
        if (error.message.includes('already registered')) {
          setErrors({ email: t('auth.errors.emailInUse') });
        } else {
          toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
        }
      } else {
        toast({ title: t('auth.signup.success'), description: t('auth.signup.welcomeMessage') });
        navigate(postAuthTarget);
      }
    } catch (error) {
      toast({ title: t('common.error'), description: t('auth.errors.accountCreationError'), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // ───── Registration Form ─────
  const renderRegistrationForm = () => (
    <div className="w-full max-w-xl">
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
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Personal info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-2">
                {t('auth.signup.personalInfo')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">{t('auth.fields.fullName')} *</Label>
                  <Input id="fullName" placeholder={t('auth.placeholders.fullName')} value={formData.fullName} onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))} className={errors.fullName ? 'border-destructive' : ''} disabled={isLoading} />
                  {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="functionTitle">{t('auth.fields.functionTitle')} *</Label>
                  <select id="functionTitle" value={formData.functionTitle} onChange={(e) => setFormData(prev => ({ ...prev, functionTitle: e.target.value }))} disabled={isLoading} className={cn("flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", errors.functionTitle ? 'border-destructive' : '')}>
                    <option value="">{t('auth.placeholders.selectFunction')}</option>
                    {FUNCTION_TITLES.map((title) => <option key={title.value} value={title.value}>{title.label}</option>)}
                  </select>
                  {errors.functionTitle && <p className="text-sm text-destructive">{errors.functionTitle}</p>}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="company">{t('auth.fields.company')} *</Label>
                  <Input id="company" placeholder={t('auth.placeholders.company')} value={formData.company} onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))} className={errors.company ? 'border-destructive' : ''} disabled={isLoading} />
                  {errors.company && <p className="text-sm text-destructive">{errors.company}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t('auth.fields.professionalEmail')} *</Label>
                  <Input id="email" type="email" placeholder={t('auth.placeholders.professionalEmail')} value={formData.email} onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))} className={errors.email ? 'border-destructive' : ''} disabled={isLoading} />
                  {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                </div>
              </div>
            </div>

            {/* Fleet info */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-2">
                {t('auth.signup.fleetSection')}
              </h3>
              <div className="space-y-2">
                <Label htmlFor="fleetSize">{t('auth.fields.fleetSize')} *</Label>
                <select id="fleetSize" value={formData.fleetSize} onChange={(e) => setFormData(prev => ({ ...prev, fleetSize: e.target.value }))} disabled={isLoading} className={cn("flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50", errors.fleetSize ? 'border-destructive' : '')}>
                  <option value="">{t('auth.placeholders.vehicleCount')}</option>
                  {FLEET_SIZES.map((size) => <option key={size.value} value={size.value}>{size.label}</option>)}
                </select>
                {errors.fleetSize && <p className="text-sm text-destructive">{errors.fleetSize}</p>}
              </div>
              <div className="space-y-2">
                <Label>
                  {t('auth.fields.fleetType')} *{' '}
                  <span className="text-muted-foreground font-normal">{t('auth.fields.multipleChoices')}</span>
                </Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                  {FLEET_TYPES.map((type) => {
                    const checked = formData.fleetTypes.includes(type.id);
                    const inputId = `fleetType-${type.id}`;
                    return (
                      <label key={type.id} htmlFor={inputId} className={cn("flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all", checked ? 'border-primary bg-primary/5 text-primary' : 'border-border hover:border-primary/50 hover:bg-muted/50', isLoading ? 'opacity-50 pointer-events-none' : '')}>
                        <input id={inputId} type="checkbox" checked={checked} disabled={isLoading} onChange={(e) => { const nextChecked = e.target.checked; setFormData((prev) => ({ ...prev, fleetTypes: nextChecked ? [...prev.fleetTypes.filter(t => t !== type.id), type.id] : prev.fleetTypes.filter((t) => t !== type.id) })); }} className="h-4 w-4" style={{ accentColor: 'hsl(var(--primary))' }} />
                        <span className="text-sm font-medium">{type.label}</span>
                      </label>
                    );
                  })}
                </div>
                {errors.fleetTypes && <p className="text-sm text-destructive">{errors.fleetTypes}</p>}
              </div>
            </div>

            {/* Security */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide border-b pb-2">
                {t('auth.signup.securitySection')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="password">{t('auth.fields.password')} *</Label>
                  <div className="relative">
                    <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={formData.password} onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))} className={`pr-10 ${errors.password ? 'border-destructive' : ''}`} disabled={isLoading} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="space-y-1 text-xs">
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
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">{t('auth.fields.confirmPassword')} *</Label>
                  <div className="relative">
                    <Input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} placeholder="••••••••" value={formData.confirmPassword} onChange={(e) => setFormData(prev => ({ ...prev, confirmPassword: e.target.value }))} className={`pr-10 ${errors.confirmPassword ? 'border-destructive' : ''}`} disabled={isLoading} />
                    <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-sm text-destructive">{errors.confirmPassword}</p>}
                  {formData.confirmPassword && formData.password === formData.confirmPassword && (
                    <p className="text-sm text-green-600 flex items-center gap-1">
                      <Check className="h-3 w-3" /> {t('auth.validation.passwordsMatch')}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Newsletter */}
            <div className={cn("flex items-start gap-3 p-4 rounded-lg border border-border/50 bg-muted/30 transition-all hover:border-primary/30", isLoading ? 'opacity-50 pointer-events-none' : '')}>
              <input id="newsletter" type="checkbox" checked={formData.newsletterOptIn} disabled={isLoading} onChange={(e) => setFormData(prev => ({ ...prev, newsletterOptIn: e.target.checked }))} className="mt-1 h-4 w-4" style={{ accentColor: 'hsl(var(--primary))' }} />
              <div className="space-y-1">
                <label htmlFor="newsletter" className="cursor-pointer font-medium">{t('auth.signup.newsletter')}</label>
                <p className="text-xs text-muted-foreground">{t('auth.signup.newsletterDesc')}</p>
              </div>
            </div>

            <Button type="submit" className="w-full h-12 text-base" disabled={isLoading}>
              {isLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('auth.signup.creating')}</>) : t('auth.signup.createButton')}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              {t('auth.login.alreadyHaveAccount')}{' '}
              <Link to="/login" className="text-primary hover:underline font-medium">{t('auth.login.signInButton')}</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );

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

      {/* Right side */}
      <div className="flex-1 flex items-center justify-center p-6 bg-background overflow-y-auto">
        {renderRegistrationForm()}
      </div>
    </div>
  );
}
