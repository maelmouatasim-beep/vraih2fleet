import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { 
  User, 
  Globe, 
  Bell, 
  Palette, 
  Save,
  Mail,
  Building,
  Lock,
  Loader2,
  Send,
  FileText
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Page, PageHeader } from "@/components/layout/Page";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useEmailNotifications } from "@/hooks/useEmailNotifications";
import { useNotificationPreferences } from "@/hooks/useNotificationPreferences";
import { CATEGORIES } from "@/lib/notifications/model";
import { supabase } from "@/integrations/supabase/client";
import { z } from "zod";
import { useOrganization } from "@/hooks/useOrganization";
import { updateOrganization } from "@/lib/supabase/organizations";
import { langueCourte, memoriserChoixLangue } from "@/i18n/preference";

/** Envoi de courriels branché (SendGrid) sur ce déploiement — variable publique de build. */
const COURRIELS_ACTIFS = import.meta.env.VITE_EMAILS_ACTIVE === "true";

const Settings = () => {
  const { t, i18n } = useTranslation();
  const { user, profile, updateProfile } = useAuth();
  const { preferences: emailPreferences, togglePreference, isSaving: isSavingEmail } = useEmailNotifications();
  const inApp = useNotificationPreferences();
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  const [profileData, setProfileData] = useState({
    full_name: "",
    company: "",
  });

  const [passwordData, setPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
  });
  
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  // Phase 2e : les préférences sont RÉELLEMENT enregistrées — la langue
  // via i18next (persistée en localStorage par le détecteur), la devise
  // et la région sur l'organisation (défauts produit : CAD, Québec).
  const { organization, refetch: refetchOrganization } = useOrganization();
  const languePref = langueCourte(i18n.resolvedLanguage ?? i18n.language);

  const changerLangue = (v: string) => {
    const langue = langueCourte(v);
    memoriserChoixLangue(window.localStorage, langue);
    void i18n.changeLanguage(langue);
  };

  const changerOrganisation = async (patch: { currency?: string; region?: string }) => {
    if (!organization) return;
    if (organization.myRole !== "admin") {
      toast({
        title: t('pages.settings.toast.error'),
        description: t('pages.settings.preferences.adminOnly'),
        variant: "destructive",
      });
      return;
    }
    try {
      await updateOrganization(organization.id, patch);
      await refetchOrganization();
      toast({ title: t('pages.settings.toast.saved'), description: t('pages.settings.toast.savedDesc') });
    } catch {
      toast({
        title: t('pages.settings.toast.error'),
        description: t('pages.settings.toast.errorSaving'),
        variant: "destructive",
      });
    }
  };

  const passwordSchema = z.object({
    newPassword: z.string().min(8, t('pages.settings.password.minLength')),
    confirmPassword: z.string(),
  }).refine((data) => data.newPassword === data.confirmPassword, {
    message: t('pages.settings.password.mismatch'),
    path: ["confirmPassword"],
  });

  useEffect(() => {
    if (profile) {
      setProfileData({
        full_name: profile.full_name || "",
        company: profile.company || "",
      });
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    setIsSaving(true);
    
    const { error } = await updateProfile({
      full_name: profileData.full_name,
      company: profileData.company,
    });
    
    if (error) {
      toast({
        title: t('pages.settings.toast.error'),
        description: t('pages.settings.toast.errorSaving'),
        variant: "destructive",
      });
    } else {
      toast({
        title: t('pages.settings.toast.saved'),
        description: t('pages.settings.toast.savedDesc'),
      });
    }
    
    setIsSaving(false);
  };

  const handleChangePassword = async () => {
    setPasswordErrors({});
    
    const result = passwordSchema.safeParse(passwordData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        fieldErrors[field] = err.message;
      });
      setPasswordErrors(fieldErrors);
      return;
    }
    
    setIsChangingPassword(true);
    
    const { error } = await supabase.auth.updateUser({
      password: passwordData.newPassword,
    });
    
    if (error) {
      toast({
        title: t('pages.settings.toast.error'),
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: t('pages.settings.toast.passwordChanged'),
        description: t('pages.settings.toast.passwordChangedDesc'),
      });
      setPasswordData({ newPassword: "", confirmPassword: "" });
    }
    
    setIsChangingPassword(false);
  };

  return (
    <DashboardLayout>
      <Page largeur="etroite">
        <PageHeader
          titre={t('pages.settings.title')}
          sousTitre={t('pages.settings.subtitle')}
          actions={
            <Button onClick={handleSaveProfile} className="gap-2" disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('pages.settings.save')}
            </Button>
          }
        />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              {t('pages.settings.profile.title')}
            </CardTitle>
            <CardDescription>
              {t('pages.settings.profile.subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">{t('pages.settings.profile.fullName')}</Label>
                <Input
                  id="name"
                  value={profileData.full_name}
                  onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">{t('pages.settings.profile.email')}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    className="pl-9"
                    value={user?.email || ""}
                    disabled
                  />
                </div>
                <p className="text-xs text-muted-foreground">{t('pages.settings.profile.emailNote')}</p>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company">{t('pages.settings.profile.company')}</Label>
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="company"
                  className="pl-9"
                  value={profileData.company}
                  onChange={(e) => setProfileData({ ...profileData, company: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              {t('pages.settings.password.title')}
            </CardTitle>
            <CardDescription>
              {t('pages.settings.password.subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">{t('pages.settings.password.newPassword')}</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="••••••••"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                />
                {passwordErrors.newPassword && (
                  <p className="text-sm text-destructive">{passwordErrors.newPassword}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">{t('pages.settings.password.confirmPassword')}</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                />
                {passwordErrors.confirmPassword && (
                  <p className="text-sm text-destructive">{passwordErrors.confirmPassword}</p>
                )}
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={handleChangePassword}
              disabled={isChangingPassword || !passwordData.newPassword}
            >
              {isChangingPassword ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {t('pages.settings.password.changeButton')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5" />
              {t('pages.settings.preferences.title')}
            </CardTitle>
            <CardDescription>
              {t('pages.settings.preferences.subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>{t('pages.settings.preferences.language')}</Label>
                <Select value={languePref} onValueChange={changerLangue}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('pages.settings.preferences.defaultCurrency')}</Label>
                <Select
                  value={organization?.currency ?? "CAD"}
                  onValueChange={(v) => void changerOrganisation({ currency: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CAD">{t('settings.currencies.cad')}</SelectItem>
                    <SelectItem value="USD">{t('settings.currencies.usd')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('pages.settings.preferences.defaultRegion')}</Label>
                <Select
                  value={organization?.region ?? "CA_QC"}
                  onValueChange={(v) => void changerOrganisation({ region: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CA_QC">{t('settings.regions.ca_qc')}</SelectItem>
                    <SelectItem value="CA_ON">{t('settings.regions.ca_on')}</SelectItem>
                    <SelectItem value="CA_BC">{t('settings.regions.ca_bc')}</SelectItem>
                    <SelectItem value="CA_AB">{t('settings.regions.ca_ab')}</SelectItem>
                    <SelectItem value="CA">{t('settings.regions.ca')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="notification-preferences">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              {t('pages.settings.notifications.title')}
            </CardTitle>
            <CardDescription>
              {t('pages.settings.notifications.subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {CATEGORIES.map((categorie, i) => (
              <div key={categorie} className="space-y-4">
                {i > 0 && <Separator />}
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label htmlFor={`notif-${categorie}`}>{t(`pages.settings.notifications.${categorie}`)}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t(`pages.settings.notifications.${categorie}Desc`)}
                    </p>
                  </div>
                  <Switch
                    id={`notif-${categorie}`}
                    checked={inApp.preferences[categorie]}
                    onCheckedChange={() => inApp.basculer(categorie)}
                    disabled={inApp.isLoading || inApp.isSaving}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Email Notifications Card */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-primary" />
              {t('pages.settings.emailNotifications.title', 'Notifications par email')}
            </CardTitle>
            <CardDescription>
              {t('pages.settings.emailNotifications.subtitle', 'Recevez des emails pour les événements importants')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!COURRIELS_ACTIFS && (
              <p className="text-sm rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-800 dark:text-amber-200" data-testid="emails-not-active">
                {t('pages.settings.emailNotifications.notActive')}
              </p>
            )}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('pages.settings.emailNotifications.subsidyReminders', 'Rappels d\'échéances subventions')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('pages.settings.emailNotifications.subsidyRemindersDesc', 'Rappels 7 jours et 1 jour avant les dates limites de demande')}
                </p>
              </div>
              <Switch
                checked={emailPreferences.subsidy_reminders}
                onCheckedChange={() => togglePreference('subsidy_reminders')}
                disabled={isSavingEmail}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('pages.settings.emailNotifications.planAlerts')}</Label>
                <p className="text-sm text-muted-foreground">{t('pages.settings.emailNotifications.planAlertsDesc')}</p>
              </div>
              <Switch
                checked={emailPreferences.plan_alerts}
                onCheckedChange={() => togglePreference('plan_alerts')}
                disabled={isSavingEmail}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('pages.settings.emailNotifications.collaborationInvites', 'Invitations à collaborer')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('pages.settings.emailNotifications.collaborationInvitesDesc', 'Quand quelqu\'un vous ajoute à un projet')}
                </p>
              </div>
              <Switch
                checked={emailPreferences.collaboration_invites}
                onCheckedChange={() => togglePreference('collaboration_invites')}
                disabled={isSavingEmail}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('pages.settings.emailNotifications.projectComments', 'Commentaires sur mes projets')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('pages.settings.emailNotifications.projectCommentsDesc', 'Quand quelqu\'un commente un de vos projets')}
                </p>
              </div>
              <Switch
                checked={emailPreferences.project_comments}
                onCheckedChange={() => togglePreference('project_comments')}
                disabled={isSavingEmail}
              />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('pages.settings.emailNotifications.weeklyDigest', 'Résumé hebdomadaire')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('pages.settings.emailNotifications.weeklyDigestDesc', 'Un récapitulatif de l\'activité de vos projets chaque lundi')}
                </p>
              </div>
              <Switch
                checked={emailPreferences.weekly_digest}
                onCheckedChange={() => togglePreference('weekly_digest')}
                disabled={isSavingEmail}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="w-5 h-5" />
              {t('pages.settings.appearance.title')}
            </CardTitle>
            <CardDescription>
              {t('pages.settings.appearance.subtitle')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('pages.settings.appearance.darkTheme')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('pages.settings.appearance.darkThemeDesc')}
                </p>
              </div>
              <Switch disabled />
            </div>
          </CardContent>
        </Card>
      </Page>
    </DashboardLayout>
  );
};

export default Settings;