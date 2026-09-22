import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { 
  Mail, 
  MapPin, 
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
      
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: 'contact@h2fleet.ca',
          subject: `[Contact] ${subjectLabels[formData.subject] || formData.subject}`,
          htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #0ea5e9 0%, #22c55e 100%); padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">New Contact Form Submission</h1>
              </div>
              <div style="padding: 24px; background: #f9fafb;">
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 8px 0; color: #6b7280;"><strong>Name:</strong></td><td style="padding: 8px 0;">${formData.name}</td></tr>
                  <tr><td style="padding: 8px 0; color: #6b7280;"><strong>Email:</strong></td><td style="padding: 8px 0;">${formData.email}</td></tr>
                  ${formData.company ? `<tr><td style="padding: 8px 0; color: #6b7280;"><strong>Company:</strong></td><td style="padding: 8px 0;">${formData.company}</td></tr>` : ''}
                  ${formData.fleetSize ? `<tr><td style="padding: 8px 0; color: #6b7280;"><strong>Fleet Size:</strong></td><td style="padding: 8px 0;">${formData.fleetSize}</td></tr>` : ''}
                  <tr><td style="padding: 8px 0; color: #6b7280;"><strong>Subject:</strong></td><td style="padding: 8px 0;">${subjectLabels[formData.subject] || formData.subject}</td></tr>
                </table>
                <div style="margin-top: 20px; padding: 16px; background: white; border-radius: 8px;">
                  <h3 style="margin: 0 0 12px 0; color: #1f2937;">Message:</h3>
                  <p style="margin: 0; color: #374151; white-space: pre-wrap;">${formData.message}</p>
                </div>
              </div>
            </div>
          `,
          textContent: `New contact from ${formData.name} (${formData.email})\n\nSubject: ${subjectLabels[formData.subject] || formData.subject}\n\nMessage:\n${formData.message}`,
        },
      });

      if (error) throw error;

      toast({
        title: t('pages.contact.form.success.title'),
        description: t('pages.contact.form.success.message'),
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

  const contactInfo = [
    {
      icon: Mail,
      titleKey: "pages.contact.info.email.title",
      value: "contact@h2fleet.ca",
      color: "bg-primary/10 text-primary",
    },
    {
      icon: MapPin,
      titleKey: "pages.contact.info.address.title",
      value: "Montreal, Quebec, Canada",
      color: "bg-accent/10 text-accent",
    },
  ];

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
              
              {contactInfo.map((info) => (
                <Card key={info.titleKey} className="border-border/50">
                  <CardContent className="p-4 flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-xl ${info.color} flex items-center justify-center shrink-0`}>
                      <info.icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground mb-1">
                        {t(info.titleKey)}
                      </h3>
                      <p className="text-muted-foreground text-sm">
                        {info.value}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}

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
