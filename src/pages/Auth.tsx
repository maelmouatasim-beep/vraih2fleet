import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Leaf, Mail, Lock, User, Building2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";

const Auth = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  
  const [registerName, setRegisterName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerOrgName, setRegisterOrgName] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: t('auth.legacy.loginSuccess'),
        description: t('auth.legacy.loginSuccessDesc'),
      });
      navigate("/dashboard");
    }, 1000);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: t('auth.legacy.registerSuccess'),
        description: t('auth.legacy.registerSuccessDesc'),
      });
      navigate("/dashboard");
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-hero relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIwOS0xLjc5MS00LTQtNHMtNCAxLjc5MS00IDQgMS43OTEgNCA0IDQgNC0xLjc5MSA0LTR6bTAtMjBjMC0yLjIwOS0xLjc5MS00LTQtNHMtNCAxLjc5MS00IDQgMS43OTEgNCA0IDQgNC0xLjc5MSA0LTR6Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-30" />
        
        <div className="relative z-10 flex flex-col justify-center px-12 lg:px-20">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <Leaf className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">H2Fleet Planner</span>
          </div>
          
          <h1 className="text-4xl lg:text-5xl font-bold text-white mb-6 leading-tight">
            {t('auth.legacy.branding.title')}<br />
            {t('auth.legacy.branding.titleLine2')}
          </h1>
          
          <p className="text-white/80 text-lg mb-8 max-w-md">
            {t('auth.legacy.branding.subtitle')}
          </p>
          
          <div className="space-y-4">
            {[1, 2, 3].map((num) => (
              <div key={num} className="flex items-center gap-3 text-white/90">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-sm font-semibold">{num}</span>
                </div>
                <span>{t(`auth.legacy.branding.step${num}`)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Right side - Auth forms */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl gradient-hero flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-foreground">H2Fleet Planner</span>
          </div>
          
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">{t('auth.legacy.loginTab')}</TabsTrigger>
              <TabsTrigger value="register">{t('auth.legacy.registerTab')}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <Card>
                <CardHeader>
                  <CardTitle>{t('auth.legacy.loginTitle')}</CardTitle>
                  <CardDescription>{t('auth.legacy.loginSubtitle')}</CardDescription>
                </CardHeader>
                <form onSubmit={handleLogin}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="login-email">{t('auth.fields.email')}</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input id="login-email" type="email" placeholder={t('auth.placeholders.email')} className="pl-10" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="login-password">{t('auth.fields.password')}</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input id="login-password" type="password" placeholder="••••••••" className="pl-10" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                        {t('auth.legacy.forgotPassword')}
                      </Link>
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                      {isLoading ? t('auth.legacy.signingIn') : t('auth.legacy.signIn')}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>
            
            <TabsContent value="register">
              <Card>
                <CardHeader>
                  <CardTitle>{t('auth.legacy.registerTitle')}</CardTitle>
                  <CardDescription>{t('auth.legacy.registerSubtitle')}</CardDescription>
                </CardHeader>
                <form onSubmit={handleRegister}>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="register-name">{t('auth.legacy.fullName')}</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input id="register-name" type="text" placeholder={t('auth.legacy.fullNamePlaceholder')} className="pl-10" value={registerName} onChange={(e) => setRegisterName(e.target.value)} required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-email">{t('auth.legacy.professionalEmail')}</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input id="register-email" type="email" placeholder={t('auth.legacy.emailPlaceholder')} className="pl-10" value={registerEmail} onChange={(e) => setRegisterEmail(e.target.value)} required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-org">{t('auth.legacy.orgName')}</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input id="register-org" type="text" placeholder={t('auth.legacy.orgPlaceholder')} className="pl-10" value={registerOrgName} onChange={(e) => setRegisterOrgName(e.target.value)} required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="register-password">{t('auth.legacy.password')}</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input id="register-password" type="password" placeholder="••••••••" className="pl-10" value={registerPassword} onChange={(e) => setRegisterPassword(e.target.value)} required minLength={8} />
                      </div>
                      <p className="text-xs text-muted-foreground">{t('auth.legacy.minChars')}</p>
                    </div>
                  </CardContent>
                  <CardFooter className="flex flex-col gap-4">
                    <Button type="submit" className="w-full gap-2" disabled={isLoading}>
                      {isLoading ? t('auth.legacy.creating') : t('auth.legacy.createAccount')}
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                    <p className="text-xs text-muted-foreground text-center">
                      {t('auth.legacy.termsPrefix')}{" "}
                      <Link to="/terms" className="text-primary hover:underline">
                        {t('auth.legacy.termsLink')}
                      </Link>
                    </p>
                  </CardFooter>
                </form>
              </Card>
            </TabsContent>
          </Tabs>
          
          <div className="mt-6 text-center">
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← {t('auth.legacy.backToHome')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
