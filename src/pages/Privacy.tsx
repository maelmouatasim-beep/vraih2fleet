import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, Shield, Database, Eye, Lock, Cookie, Users, Trash2, Globe, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Footer from '@/components/landing/Footer';
import Navbar from '@/components/landing/Navbar';

const Privacy = () => {
  const { t } = useTranslation();

  useEffect(() => {
    document.title = `${t('pages.privacy.title')} | H2Fleet Planner`;
  }, [t]);

  const effectiveDate = t('pages.privacy.dates.effective');
  const lastUpdated = t('pages.privacy.dates.lastUpdated');

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link to="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('pages.privacy.backToHome')}
            </Button>
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{t('pages.privacy.title')}</h1>
              <p className="text-muted-foreground">H2Fleet Planner</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mb-4">
            <Badge variant="outline">{t('pages.privacy.badges.pipeda')}</Badge>
            <Badge variant="outline">{t('pages.privacy.badges.gdpr')}</Badge>
          </div>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>{t('pages.privacy.effectiveDate')}: {effectiveDate}</span>
            <span>•</span>
            <span>{t('pages.privacy.lastUpdated')}: {lastUpdated}</span>
          </div>
        </div>

        <Separator className="mb-8" />

        {/* Introduction */}
        <Card className="mb-6">
          <CardContent className="pt-6 space-y-4">
            <p className="text-muted-foreground leading-relaxed">
              {t('pages.privacy.intro.paragraph1')}
            </p>
            <p className="text-muted-foreground leading-relaxed">
              {t('pages.privacy.intro.paragraph2')}
            </p>
            <Alert className="border-primary/20 bg-primary/5">
              <AlertTriangle className="h-4 w-4 text-primary" />
              <AlertDescription className="text-foreground font-medium">
                {t('pages.privacy.intro.controllerProcessor')}
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Section 1: Information We Collect */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              {t('pages.privacy.sections.collect.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">{t('pages.privacy.sections.collect.provided.title')}</h4>
              <p className="text-muted-foreground mb-2">{t('pages.privacy.sections.collect.provided.intro')}</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li><strong>{t('pages.privacy.sections.collect.provided.account.label')}:</strong> {t('pages.privacy.sections.collect.provided.account.value')}</li>
                <li><strong>{t('pages.privacy.sections.collect.provided.company.label')}:</strong> {t('pages.privacy.sections.collect.provided.company.value')}</li>
                <li><strong>{t('pages.privacy.sections.collect.provided.payment.label')}:</strong> {t('pages.privacy.sections.collect.provided.payment.value')}</li>
                <li><strong>{t('pages.privacy.sections.collect.provided.project.label')}:</strong> {t('pages.privacy.sections.collect.provided.project.value')}</li>
                <li><strong>{t('pages.privacy.sections.collect.provided.communications.label')}:</strong> {t('pages.privacy.sections.collect.provided.communications.value')}</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">{t('pages.privacy.sections.collect.automatic.title')}</h4>
              <p className="text-muted-foreground mb-2">{t('pages.privacy.sections.collect.automatic.intro')}</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li><strong>{t('pages.privacy.sections.collect.automatic.usage.label')}:</strong> {t('pages.privacy.sections.collect.automatic.usage.value')}</li>
                <li><strong>{t('pages.privacy.sections.collect.automatic.device.label')}:</strong> {t('pages.privacy.sections.collect.automatic.device.value')}</li>
                <li><strong>{t('pages.privacy.sections.collect.automatic.log.label')}:</strong> {t('pages.privacy.sections.collect.automatic.log.value')}</li>
                <li><strong>{t('pages.privacy.sections.collect.automatic.analytics.label')}:</strong> {t('pages.privacy.sections.collect.automatic.analytics.value')}</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">{t('pages.privacy.sections.collect.thirdParty.title')}</h4>
              <p className="text-muted-foreground">
                {t('pages.privacy.sections.collect.thirdParty.content')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: How We Use Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              {t('pages.privacy.sections.use.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">{t('pages.privacy.sections.use.provision.title')}</h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>{t('pages.privacy.sections.use.provision.item1')}</li>
                <li>{t('pages.privacy.sections.use.provision.item2')}</li>
                <li>{t('pages.privacy.sections.use.provision.item3')}</li>
                <li>{t('pages.privacy.sections.use.provision.item4')}</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">{t('pages.privacy.sections.use.improvement.title')}</h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>{t('pages.privacy.sections.use.improvement.item1')}</li>
                <li>{t('pages.privacy.sections.use.improvement.item2')}</li>
                <li>{t('pages.privacy.sections.use.improvement.item3')}</li>
                <li>{t('pages.privacy.sections.use.improvement.item4')}</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">{t('pages.privacy.sections.use.communications.title')}</h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>{t('pages.privacy.sections.use.communications.item1')}</li>
                <li>{t('pages.privacy.sections.use.communications.item2')}</li>
                <li>{t('pages.privacy.sections.use.communications.item3')}</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">{t('pages.privacy.sections.use.legalBases.title')}</h4>
              <p className="text-muted-foreground">
                {t('pages.privacy.sections.use.legalBases.content')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Data Storage and Security */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              {t('pages.privacy.sections.security.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">{t('pages.privacy.sections.security.storage.title')}</h4>
              <p className="text-muted-foreground">
                {t('pages.privacy.sections.security.storage.content')}
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">{t('pages.privacy.sections.security.measures.title')}</h4>
              <p className="text-muted-foreground mb-2">{t('pages.privacy.sections.security.measures.intro')}</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>{t('pages.privacy.sections.security.measures.item1')}</li>
                <li>{t('pages.privacy.sections.security.measures.item2')}</li>
                <li>{t('pages.privacy.sections.security.measures.item3')}</li>
                <li>{t('pages.privacy.sections.security.measures.item4')}</li>
                <li>{t('pages.privacy.sections.security.measures.item5')}</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">{t('pages.privacy.sections.security.breach.title')}</h4>
              <p className="text-muted-foreground">
                {t('pages.privacy.sections.security.breach.content')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: User Rights */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {t('pages.privacy.sections.rights.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">{t('pages.privacy.sections.rights.access.title')}</h4>
              <p className="text-muted-foreground">
                {t('pages.privacy.sections.rights.access.content')}
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">{t('pages.privacy.sections.rights.correction.title')}</h4>
              <p className="text-muted-foreground">
                {t('pages.privacy.sections.rights.correction.content')}
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">{t('pages.privacy.sections.rights.deletion.title')}</h4>
              <p className="text-muted-foreground">
                {t('pages.privacy.sections.rights.deletion.content')}
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">{t('pages.privacy.sections.rights.restriction.title')}</h4>
              <p className="text-muted-foreground">
                {t('pages.privacy.sections.rights.restriction.content')}
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">{t('pages.privacy.sections.rights.complaints.title')}</h4>
              <p className="text-muted-foreground">
                {t('pages.privacy.sections.rights.complaints.content')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Cookies */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cookie className="h-5 w-5 text-primary" />
              {t('pages.privacy.sections.cookies.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">{t('pages.privacy.sections.cookies.types.title')}</h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li><strong>{t('pages.privacy.sections.cookies.types.essential.label')}:</strong> {t('pages.privacy.sections.cookies.types.essential.value')}</li>
                <li><strong>{t('pages.privacy.sections.cookies.types.functional.label')}:</strong> {t('pages.privacy.sections.cookies.types.functional.value')}</li>
                <li><strong>{t('pages.privacy.sections.cookies.types.analytics.label')}:</strong> {t('pages.privacy.sections.cookies.types.analytics.value')}</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">{t('pages.privacy.sections.cookies.managing.title')}</h4>
              <p className="text-muted-foreground">
                {t('pages.privacy.sections.cookies.managing.content')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 6: Third-Party Services */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              {t('pages.privacy.sections.thirdParty.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">{t('pages.privacy.sections.thirdParty.payment.title')}</h4>
              <p className="text-muted-foreground">
                {t('pages.privacy.sections.thirdParty.payment.content')}
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">{t('pages.privacy.sections.thirdParty.infrastructure.title')}</h4>
              <p className="text-muted-foreground">
                {t('pages.privacy.sections.thirdParty.infrastructure.content')}
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">{t('pages.privacy.sections.thirdParty.analytics.title')}</h4>
              <p className="text-muted-foreground">
                {t('pages.privacy.sections.thirdParty.analytics.content')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 7: Data Retention */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-primary" />
              {t('pages.privacy.sections.retention.title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">{t('pages.privacy.sections.retention.active.title')}</h4>
              <p className="text-muted-foreground">
                {t('pages.privacy.sections.retention.active.content')}
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">{t('pages.privacy.sections.retention.closure.title')}</h4>
              <p className="text-muted-foreground">
                {t('pages.privacy.sections.retention.closure.content')}
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">{t('pages.privacy.sections.retention.aggregated.title')}</h4>
              <p className="text-muted-foreground">
                {t('pages.privacy.sections.retention.aggregated.content')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 8: Children's Privacy */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('pages.privacy.sections.children.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {t('pages.privacy.sections.children.content')}
            </p>
          </CardContent>
        </Card>

        {/* Section 9: Changes to Policy */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('pages.privacy.sections.changes.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              {t('pages.privacy.sections.changes.content')}
            </p>
          </CardContent>
        </Card>

        {/* Section 10: Contact */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('pages.privacy.sections.contact.title')}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              {t('pages.privacy.sections.contact.intro')}
            </p>
            <p className="text-muted-foreground">
              <strong>H2Fleet Technologies Inc.</strong><br />
              {t('pages.privacy.sections.contact.officer')}<br />
              {t('pages.privacy.sections.contact.emailLabel')}: contact@h2fleet.ca<br />
              {t('pages.privacy.sections.contact.addressLabel')}: Montreal, Quebec, Canada
            </p>
          </CardContent>
        </Card>

        {/* Related Links */}
        <div className="flex flex-wrap gap-4 mt-8">
          <Link to="/terms">
            <Button variant="outline">{t('pages.privacy.relatedLinks.terms')}</Button>
          </Link>
          <Link to="/refund">
            <Button variant="outline">{t('pages.privacy.relatedLinks.refund')}</Button>
          </Link>
          <Link to="/contact">
            <Button variant="outline">{t('pages.privacy.relatedLinks.contact')}</Button>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Privacy;
