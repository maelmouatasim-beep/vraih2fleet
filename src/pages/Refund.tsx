import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, RefreshCw, Calendar, CreditCard, AlertTriangle, CheckCircle, XCircle, HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Footer from '@/components/landing/Footer';
import Navbar from '@/components/landing/Navbar';

const Refund = () => {
  useEffect(() => {
    document.title = 'Refund Policy | H2Fleet Planner';
  }, []);

  const effectiveDate = 'December 25, 2025';
  const lastUpdated = 'December 25, 2025';

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <Link to="/">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <RefreshCw className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Refund Policy</h1>
              <p className="text-muted-foreground">H2Fleet Planner</p>
            </div>
          </div>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>Effective Date: {effectiveDate}</span>
            <span>•</span>
            <span>Last Updated: {lastUpdated}</span>
          </div>
        </div>

        <Separator className="mb-8" />

        {/* Quick Summary */}
        <Alert className="mb-8 border-primary/20 bg-primary/5">
          <HelpCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Quick Summary:</strong> We offer a 14-day free trial with no payment required. After subscribing, 
            prorated refunds are available within 7 days of upgrading. Monthly subscriptions can be cancelled anytime 
            but are not refunded for partial months.
          </AlertDescription>
        </Alert>

        {/* Overview Cards */}
        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <Card className="border-green-500/20 bg-green-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="font-semibold">Free Trial</span>
              </div>
              <p className="text-sm text-muted-foreground">
                14 days free, no payment required
              </p>
            </CardContent>
          </Card>
          <Card className="border-yellow-500/20 bg-yellow-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                <span className="font-semibold">Upgrade Refunds</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Prorated within 7 days of upgrade
              </p>
            </CardContent>
          </Card>
          <Card className="border-red-500/20 bg-red-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <XCircle className="h-5 w-5 text-red-500" />
                <span className="font-semibold">No Partial Month</span>
              </div>
              <p className="text-sm text-muted-foreground">
                No refunds for partial months
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Section 1: Free Trial */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              1. 14-Day Free Trial
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              All new users are eligible for a <strong>14-day free trial</strong> of H2Fleet Planner. During this trial period:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>No payment information is required to start the trial</li>
              <li>You have full access to all features of your selected plan tier</li>
              <li>You may cancel at any time during the trial without any charges</li>
              <li>At the end of the trial, you must subscribe to continue using the Service</li>
            </ul>
            <Alert className="mt-4">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Since no payment is collected during the trial period, no refunds are applicable for the free trial.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Section 2: Monthly Subscriptions */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              2. Monthly Subscription Billing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">2.1 Billing Cycle</h4>
              <p className="text-muted-foreground">
                Subscriptions are billed on a monthly basis, charged in advance at the beginning of each billing cycle. 
                Your billing date is determined by the date you first subscribed.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">2.2 Subscription Tiers</h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li><strong>Small Fleet:</strong> $799 USD/month (10-50 vehicles)</li>
                <li><strong>Medium Fleet:</strong> $2,499 USD/month (51-200 vehicles)</li>
                <li><strong>Large Fleet:</strong> $4,999 USD/month (201+ vehicles)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">2.3 No Refunds for Partial Months</h4>
              <p className="text-muted-foreground">
                We do not provide refunds or credits for partial months of service. If you cancel your subscription, 
                you will retain access to the Service until the end of your current billing period.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Upgrade Refunds */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              3. Upgrade and Downgrade Policy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">3.1 Upgrading Your Plan</h4>
              <p className="text-muted-foreground">
                When you upgrade to a higher tier, the upgrade takes effect immediately. You will be charged a prorated 
                amount for the remainder of your current billing period, plus the difference in subscription cost.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">3.2 Prorated Refunds for Upgrades</h4>
              <p className="text-muted-foreground">
                If you upgrade to a higher plan and realize it does not meet your needs, you may request a 
                <strong> prorated refund within 7 days</strong> of the upgrade. The refund will be calculated as follows:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li>Refund amount = (New tier price - Original tier price) × (Days remaining / 30)</li>
                <li>You will be downgraded to your previous plan</li>
                <li>Refunds are processed within 5-10 business days</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">3.3 Downgrading Your Plan</h4>
              <p className="text-muted-foreground">
                You may downgrade to a lower tier at any time. Downgrades take effect at the start of your next 
                billing cycle. No refunds or credits are provided for the current billing period.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Cancellation */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-primary" />
              4. Cancellation Process
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">4.1 How to Cancel</h4>
              <p className="text-muted-foreground">
                You may cancel your subscription at any time through your account settings:
              </p>
              <ol className="list-decimal list-inside text-muted-foreground mt-2 space-y-1">
                <li>Log in to your H2Fleet Planner account</li>
                <li>Navigate to Settings → Subscription</li>
                <li>Click "Cancel Subscription"</li>
                <li>Confirm your cancellation</li>
              </ol>
            </div>
            <div>
              <h4 className="font-semibold mb-2">4.2 Effect of Cancellation</h4>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>You will retain access to the Service until the end of your current billing period</li>
                <li>No further charges will be made after your current billing period ends</li>
                <li>Your data will be retained for 90 days, during which you may export it</li>
                <li>After 90 days, your data may be permanently deleted</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">4.3 Reactivation</h4>
              <p className="text-muted-foreground">
                If you cancel and later wish to resubscribe, you may do so at any time. If your data has not been 
                deleted (within 90 days), it will be restored upon resubscription.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Exceptions */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              5. Refund Exceptions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Refunds may be provided at our discretion in the following exceptional circumstances:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2">
              <li>
                <strong>Service Outages:</strong> Extended service outages (more than 48 consecutive hours) that 
                significantly impact your ability to use the Service
              </li>
              <li>
                <strong>Billing Errors:</strong> Duplicate charges or incorrect billing amounts due to system errors
              </li>
              <li>
                <strong>Critical Bugs:</strong> Critical bugs that prevent core functionality and cannot be resolved 
                in a timely manner
              </li>
            </ul>
            <p className="text-muted-foreground mt-4">
              Refund requests for exceptional circumstances must be submitted in writing within 30 days of the incident.
            </p>
          </CardContent>
        </Card>

        {/* Section 6: Contact for Disputes */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-primary" />
              6. Disputes and Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">6.1 Submitting a Refund Request</h4>
              <p className="text-muted-foreground">
                To request a refund or report a billing issue, please contact our billing team:
              </p>
              <p className="text-muted-foreground mt-2">
                <strong>Email:</strong> contact@h2fleet.ca<br />
                <strong>Subject Line:</strong> Refund Request - [Your Account Email]
              </p>
              <p className="text-muted-foreground mt-2">
                Please include your account email, subscription details, and a clear explanation of your request.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">6.2 Response Time</h4>
              <p className="text-muted-foreground">
                We aim to respond to all refund requests within 2 business days. Approved refunds are typically 
                processed within 5-10 business days, depending on your payment method.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">6.3 Escalation</h4>
              <p className="text-muted-foreground">
                If you are not satisfied with our response to your refund request, you may escalate by contacting:
              </p>
              <p className="text-muted-foreground mt-2">
                <strong>H2Fleet Technologies Inc.</strong><br />
                Email: contact@h2fleet.ca<br />
                Montreal, Quebec, Canada
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 7: Changes */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>7. Changes to This Policy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              We reserve the right to modify this Refund Policy at any time. Changes will be effective upon posting 
              to our website. Your continued use of the Service after changes are posted constitutes acceptance of 
              the updated policy. Material changes that affect existing subscribers will be communicated via email 
              at least 30 days in advance.
            </p>
          </CardContent>
        </Card>

        {/* Summary Table */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Quick Reference Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 font-semibold">Scenario</th>
                    <th className="text-left py-2 font-semibold">Refund Available?</th>
                    <th className="text-left py-2 font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b">
                    <td className="py-2">Free Trial (14 days)</td>
                    <td className="py-2">N/A</td>
                    <td className="py-2">No payment collected</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">Cancel mid-month</td>
                    <td className="py-2">No</td>
                    <td className="py-2">Access until billing period ends</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">Upgrade within 7 days</td>
                    <td className="py-2">Yes (prorated)</td>
                    <td className="py-2">Contact contact@h2fleet.ca</td>
                  </tr>
                  <tr className="border-b">
                    <td className="py-2">Downgrade</td>
                    <td className="py-2">No</td>
                    <td className="py-2">Takes effect next billing cycle</td>
                  </tr>
                  <tr>
                    <td className="py-2">Service outage (48+ hrs)</td>
                    <td className="py-2">Case-by-case</td>
                    <td className="py-2">Submit request within 30 days</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Related Links */}
        <div className="flex flex-wrap gap-4 mt-8">
          <Link to="/terms">
            <Button variant="outline">Terms of Service</Button>
          </Link>
          <Link to="/privacy">
            <Button variant="outline">Privacy Policy</Button>
          </Link>
          <Link to="/contact">
            <Button variant="outline">Contact Us</Button>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Refund;