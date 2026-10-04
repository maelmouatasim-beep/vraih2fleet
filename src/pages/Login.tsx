import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { cleErreurAuth } from "@/lib/authErrors";
import { useTranslation } from "react-i18next";
import { Leaf, Mail, Lock, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Prefer ?next=/path (used by the OAuth consent flow) over location.state.
  const searchParams = new URLSearchParams(location.search);
  const rawNext = searchParams.get("next");
  const safeNext = rawNext && rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : null;
  const from = safeNext || (location.state as { from?: { pathname: string } })?.from?.pathname || "/dashboard";


  const loginSchema = z.object({
    email: z.string().email(t('auth.validation.invalidEmail')),
    password: z.string().min(1, t('auth.validation.passwordRequired')),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === "email") fieldErrors.email = err.message;
        if (err.path[0] === "password") fieldErrors.password = err.message;
      });
      setErrors(fieldErrors);
      return;
    }
    
    setIsLoading(true);
    
    const { error } = await signIn(email, password);
    
    if (error) {
      toast({
        title: t('auth.errors.loginError', 'Login error'),
        description: t(cleErreurAuth(error)),
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }
    
    toast({
      title: t('auth.loginSuccess', 'Login successful'),
      description: t('auth.welcomeBack', 'Welcome to H2Fleet!'),
    });
    
    navigate(from, { replace: true });
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero relative overflow-hidden">
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
          
          <h1 className="text-4xl font-bold text-primary-foreground mb-4">
            {t('auth.login.branding.title')}
          </h1>
          <p className="text-lg text-primary-foreground/80 max-w-md">
            {t('auth.login.branding.subtitle')}
          </p>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md">
          <Link 
            to="/" 
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('common.backToHome')}
          </Link>
          
          <Card className="border-0 shadow-xl">
            <CardHeader className="text-center pb-2">
              <div className="lg:hidden flex justify-center mb-4">
                <div className="w-12 h-12 rounded-xl gradient-hero flex items-center justify-center">
                  <Leaf className="w-6 h-6 text-primary-foreground" />
                </div>
              </div>
              <CardTitle className="text-2xl font-bold">{t('auth.login.title')}</CardTitle>
              <CardDescription>
                {t('auth.login.subtitle')}
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
                      className={`pl-9 ${errors.email ? "border-destructive" : ""}`}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email}</p>
                  )}
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">{t('auth.fields.password')}</Label>
                    <Link 
                      to="/forgot-password" 
                      className="text-sm text-primary hover:underline"
                    >
                      {t('auth.login.forgotPassword')}
                    </Link>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      className={`pl-9 ${errors.password ? "border-destructive" : ""}`}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={isLoading}
                    />
                  </div>
                  {errors.password && (
                    <p className="text-sm text-destructive">{errors.password}</p>
                  )}
                </div>
                
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('auth.login.signingIn')}
                    </>
                  ) : (
                    t('auth.login.signInButton')
                  )}
                </Button>
              </form>
              
              <div className="mt-6 text-center">
                <p className="text-sm text-muted-foreground">
                  {t('auth.login.noAccount')}{" "}
                  <Link to="/signup" className="text-primary font-medium hover:underline">
                    {t('auth.login.createAccount')}
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Login;
