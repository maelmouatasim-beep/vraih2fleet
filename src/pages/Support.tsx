import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useSubscription } from '@/hooks/useSubscription';
import { supabase } from '@/integrations/supabase/client';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { 
  Headphones, 
  Clock, 
  Zap, 
  Phone, 
  Mail, 
  MessageSquare,
  Crown,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';

const SUPPORT_CATEGORIES = [
  { value: 'technical', label: 'Technical Issue' },
  { value: 'billing', label: 'Billing Question' },
  { value: 'feature', label: 'Feature Request' },
  { value: 'account', label: 'Account Management' },
  { value: 'other', label: 'Other' },
];

const PRIORITY_LEVELS = [
  { value: 'high', label: 'High - Critical issue affecting operations', color: 'text-destructive' },
  { value: 'medium', label: 'Medium - Important but not urgent', color: 'text-amber-500' },
  { value: 'low', label: 'Low - General question', color: 'text-muted-foreground' },
];

export default function Support() {
  const { user, profile } = useAuth();
  const { tier, canAccessFeature, isLoading: subscriptionLoading } = useSubscription();
  
  const hasPrioritySupport = canAccessFeature('priority_support');
  
  // Form state
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [priority, setPriority] = useState('medium');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!subject.trim() || !category || !message.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please fill in all required fields.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const categoryLabel = SUPPORT_CATEGORIES.find(c => c.value === category)?.label || category;
      const priorityLabel = PRIORITY_LEVELS.find(p => p.value === priority)?.label || priority;
      
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: 'contact@h2fleet.ca',
          subject: `[Support${hasPrioritySupport ? ' - PRIORITY' : ''}] ${categoryLabel}: ${subject}`,
          htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: linear-gradient(135deg, #0ea5e9 0%, #22c55e 100%); padding: 20px; text-align: center;">
                <h1 style="color: white; margin: 0;">H2Fleet Support Request</h1>
              </div>
              <div style="padding: 24px; background: #f9fafb;">
                ${hasPrioritySupport ? '<div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px; margin-bottom: 16px;"><strong>⚡ PRIORITY SUPPORT REQUEST</strong></div>' : ''}
                <table style="width: 100%; border-collapse: collapse;">
                  <tr><td style="padding: 8px 0; color: #6b7280;"><strong>From:</strong></td><td style="padding: 8px 0;">${profile?.full_name || 'N/A'}</td></tr>
                  <tr><td style="padding: 8px 0; color: #6b7280;"><strong>Email:</strong></td><td style="padding: 8px 0;">${user?.email}</td></tr>
                  <tr><td style="padding: 8px 0; color: #6b7280;"><strong>Category:</strong></td><td style="padding: 8px 0;">${categoryLabel}</td></tr>
                  ${hasPrioritySupport ? `<tr><td style="padding: 8px 0; color: #6b7280;"><strong>Priority:</strong></td><td style="padding: 8px 0;">${priorityLabel}</td></tr>` : ''}
                  ${phone ? `<tr><td style="padding: 8px 0; color: #6b7280;"><strong>Callback Phone:</strong></td><td style="padding: 8px 0;">${phone}</td></tr>` : ''}
                </table>
                <div style="margin-top: 20px; padding: 16px; background: white; border-radius: 8px;">
                  <h3 style="margin: 0 0 12px 0; color: #1f2937;">Message:</h3>
                  <p style="margin: 0; color: #374151; white-space: pre-wrap;">${message}</p>
                </div>
              </div>
            </div>
          `,
          textContent: `Support request from ${profile?.full_name || user?.email}\n\nCategory: ${categoryLabel}\nSubject: ${subject}\n\nMessage:\n${message}`,
        },
      });

      if (error) throw error;

      toast({
        title: hasPrioritySupport ? 'Priority ticket submitted!' : 'Support request submitted!',
        description: hasPrioritySupport 
          ? 'Our team will respond within 4 hours.'
          : 'Our team will respond within 24-48 hours.',
      });
      
      // Reset form
      setSubject('');
      setCategory('');
      setPriority('medium');
      setPhone('');
      setMessage('');
    } catch (error) {
      console.error('Error sending support request:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit your request. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-4xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Headphones className="w-6 h-6 text-primary" />
                Support
              </h1>
              {hasPrioritySupport && (
                <Badge className="bg-accent text-accent-foreground gap-1">
                  <Crown className="w-3 h-3" />
                  Priority Support
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">
              {hasPrioritySupport 
                ? 'Get priority assistance from our expert team.'
                : 'Get help from our support team.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Support Form */}
          <div className="lg:col-span-2">
            <Card className={cn(
              hasPrioritySupport && "border-accent/50 bg-accent/5"
            )}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  {hasPrioritySupport ? 'Submit Priority Request' : 'Contact Support'}
                </CardTitle>
                <CardDescription>
                  {hasPrioritySupport 
                    ? 'Your request will be handled with priority.'
                    : 'Fill out the form below and we\'ll get back to you.'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Your Name</Label>
                      <Input
                        id="name"
                        value={profile?.full_name || ''}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        value={user?.email || ''}
                        disabled
                        className="bg-muted"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="subject">Subject *</Label>
                      <Input
                        id="subject"
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        placeholder="Brief description of your issue"
                        maxLength={100}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category *</Label>
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPPORT_CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Priority-only fields */}
                  {hasPrioritySupport && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 rounded-lg bg-accent/10 border border-accent/20">
                      <div className="space-y-2">
                        <Label htmlFor="priority" className="flex items-center gap-2">
                          <Zap className="w-4 h-4 text-accent" />
                          Priority Level
                        </Label>
                        <Select value={priority} onValueChange={setPriority}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITY_LEVELS.map((level) => (
                              <SelectItem key={level.value} value={level.value}>
                                <span className={level.color}>{level.label}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone" className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-accent" />
                          Phone for Callback (optional)
                        </Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+1 (555) 123-4567"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="message">Message *</Label>
                    <Textarea
                      id="message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Describe your issue or question in detail..."
                      rows={5}
                      maxLength={2000}
                    />
                    <p className="text-xs text-muted-foreground text-right">
                      {message.length}/2000 characters
                    </p>
                  </div>

                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className={cn(
                      "w-full",
                      hasPrioritySupport && "bg-accent hover:bg-accent/90"
                    )}
                  >
                    {isSubmitting ? 'Submitting...' : hasPrioritySupport ? 'Submit Priority Request' : 'Send Message'}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Info Sidebar */}
          <div className="space-y-4">
            {/* Response Time Card */}
            <Card className={cn(
              hasPrioritySupport && "border-accent/50"
            )}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className={cn(
                    "w-4 h-4",
                    hasPrioritySupport ? "text-accent" : "text-muted-foreground"
                  )} />
                  Response Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                {hasPrioritySupport ? (
                  <div className="space-y-2">
                    <p className="text-2xl font-bold text-accent">Within 4 hours</p>
                    <p className="text-sm text-muted-foreground">
                      Priority support ensures faster response times for your critical issues.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-2xl font-bold text-foreground">24-48 hours</p>
                    <p className="text-sm text-muted-foreground">
                      Our team will respond during business hours.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Benefits Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {hasPrioritySupport ? 'Your Priority Benefits' : 'Support Includes'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {hasPrioritySupport ? (
                    <>
                      <li className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-accent" />
                        4-hour response guarantee
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-accent" />
                        Phone callback option
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-accent" />
                        Priority ticket queue
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-accent" />
                        Dedicated support agent
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                        Email support
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                        Knowledge base access
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
                        Community forum
                      </li>
                    </>
                  )}
                </ul>
              </CardContent>
            </Card>

            {/* Upgrade prompt for non-priority users */}
            {!hasPrioritySupport && !subscriptionLoading && (
              <Card className="border-dashed">
                <CardContent className="pt-6">
                  <div className="text-center space-y-3">
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center mx-auto">
                      <Crown className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Need faster support?</p>
                      <p className="text-xs text-muted-foreground">
                        Upgrade to Medium or Large Fleet for priority support with 4-hour response times.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a href="/contact">Contact Us</a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Contact Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Other Ways to Reach Us</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span>contact@h2fleet.ca</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
