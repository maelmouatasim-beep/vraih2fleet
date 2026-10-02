import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import {
  Send,
  Building2,
  Users,
  MessageSquare
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";

const Contact = () => {
  const { t } = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Pot de miel anti-robots : champ invisible, toujours vide pour un humain.
  const [honeypot, setHoneypot] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    company: '',
    fleetSize: '',
    subject: '',
    message: ''
  });

  useEffect(() => {
    document.title = `${t('pages.contact.title')} | H2Fleet Planner`;
  }, [t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      const subjectLabels: Record<string, string> = {
        demo: t('pages.contact.form.subjects.demo'),
        pricing: t('pages.contact.form.subjects.pricing'),
        support: t('pages.contact.form.subjects.support'),
        partnership: t('pages.contact.form.subjects.partnership'),
        other: t('pages.contact.form.subjects.other'),
      };
      
      const { data: envoi, error } = await supabase.functions.invoke('send-email', {
        body: {
          templateType: 'contact',
          data: {
            name: formData.name,
            email: formData.email,
            company: formData.company || undefined,
            fleetSize: formData.fleetSize || undefined,
            subject: subjectLabels[formData.subject] || formData.subject,
            message: formData.message,
            website: honeypot || undefined,
          },
        },
      });

      if (error) throw error;

      toast({
        title: envoi?.emailSent === false
          ? t('servicesExternes.demandeEnregistree')
          : t('pages.contact.form.success.title'),
        // Demande enregistrée mais courriel non envoyé (service non branché).
        description: envoi?.emailSent === false
          ? t('servicesExternes.emailEnregistreSansEnvoi')
          : t('pages.contact.form.success.message'),
      });
      
      setFormData({
        name: '',
        email: '',
        company: '',
        fleetSize: '',
        subject: '',
        message: ''
      });
    } catch (error) {
      console.error('Error sending contact form:', error);
      toast({
        title: t('pages.contact.form.error.title', 'Error'),
        description: t('pages.contact.form.error.message', 'Failed to send your message. Please try again.'),
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };



  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="pt-32 pb-16 bg-gradient-to-br from-primary/10 via-background to-accent/5">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-4xl mx-auto">
            <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              {t('pages.contact.badge')}
            </span>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-6">
              {t('pages.contact.hero.title')}
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              {t('pages.contact.hero.subtitle')}
            </p>
          </div>
        </div>
      </section>

      {/* Contact Form & Info */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 max-w-6xl mx-auto">
            {/* Contact Info */}
            <div className="lg:col-span-1 space-y-6">
              <h2 className="text-2xl font-bold text-foreground mb-6">
                {t('pages.contact.info.title')}
              </h2>
              
              <p className="text-muted-foreground text-sm">{t('pages.contact.info.pending')}</p>

            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <Card className="border-border/50">
                <CardContent className="p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <MessageSquare className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-foreground">
                        {t('pages.contact.form.title')}
                      </h2>
                      <p className="text-muted-foreground text-sm">
                        {t('pages.contact.form.subtitle')}
                      </p>
                    </div>
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-6">
              <input
                type="text"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
              />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="name">{t('pages.contact.form.fields.name')} *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          placeholder={t('pages.contact.form.placeholders.name')}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">{t('pages.contact.form.fields.email')} *</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          placeholder={t('pages.contact.form.placeholders.email')}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="company">
                          <Building2 className="w-4 h-4 inline mr-1" />
                          {t('pages.contact.form.fields.company')}
                        </Label>
                        <Input
                          id="company"
                          value={formData.company}
                          onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                          placeholder={t('pages.contact.form.placeholders.company')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fleetSize">
                          <Users className="w-4 h-4 inline mr-1" />
                          {t('pages.contact.form.fields.fleetSize')}
                        </Label>
                        <Select
                          value={formData.fleetSize}
                          onValueChange={(value) => setFormData({ ...formData, fleetSize: value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t('pages.contact.form.placeholders.fleetSize')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1-10">{t('demoModal.fleetSizes.small')}</SelectItem>
                            <SelectItem value="11-50">{t('demoModal.fleetSizes.medium')}</SelectItem>
                            <SelectItem value="51-200">{t('demoModal.fleetSizes.large')}</SelectItem>
                            <SelectItem value="200+">{t('demoModal.fleetSizes.enterprise')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="subject">{t('pages.contact.form.fields.subject')} *</Label>
                      <Select
                        value={formData.subject}
                        onValueChange={(value) => setFormData({ ...formData, subject: value })}
                        required
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('pages.contact.form.placeholders.subject')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="demo">{t('pages.contact.form.subjects.demo')}</SelectItem>
                          <SelectItem value="pricing">{t('pages.contact.form.subjects.pricing')}</SelectItem>
                          <SelectItem value="support">{t('pages.contact.form.subjects.support')}</SelectItem>
                          <SelectItem value="partnership">{t('pages.contact.form.subjects.partnership')}</SelectItem>
                          <SelectItem value="other">{t('pages.contact.form.subjects.other')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="message">{t('pages.contact.form.fields.message')} *</Label>
                      <Textarea
                        id="message"
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        placeholder={t('pages.contact.form.placeholders.message')}
                        rows={5}
                        required
                      />
                    </div>

                    <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>{t('pages.contact.form.submitting')}</>
                      ) : (
                        <>
                          <Send className="w-5 h-5 mr-2" />
                          {t('pages.contact.form.submit')}
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Contact;
