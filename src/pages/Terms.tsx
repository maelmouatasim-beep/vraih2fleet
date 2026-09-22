import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Scale, Shield, AlertCircle, Users, Ban, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import Footer from '@/components/landing/Footer';
import Navbar from '@/components/landing/Navbar';

const Terms = () => {
  useEffect(() => {
    document.title = 'Terms of Service | H2Fleet Planner';
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
              <FileText className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Terms of Service</h1>
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

        {/* Introduction */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <p className="text-muted-foreground leading-relaxed">
              Welcome to H2Fleet Planner. These Terms of Service ("Terms") govern your access to and use of the H2Fleet Planner 
              platform, software, and services (collectively, the "Service") provided by H2Fleet Technologies Inc. ("H2Fleet," "we," "us," or "our"), 
              a company incorporated under the laws of Canada.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              By accessing or using the Service, you agree to be bound by these Terms. If you do not agree to these Terms, 
              you may not access or use the Service.
            </p>
          </CardContent>
        </Card>

        {/* Section 1: Service Description */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              1. Service Description and Scope
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">1.1 Platform Overview</h4>
              <p className="text-muted-foreground">
                H2Fleet Planner is a Software-as-a-Service (SaaS) platform designed to help fleet operators plan and analyze 
                their transition to alternative energy vehicles, including electric and hydrogen-powered vehicles. The Service includes:
              </p>
              <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1">
                <li>Total Cost of Ownership (TCO) calculations and analysis</li>
                <li>Fleet transition scenario planning and comparison tools</li>
                <li>Energy demand estimation and infrastructure planning</li>
                <li>Report generation and data export capabilities</li>
                <li>Reference data for vehicle costs, energy prices, and emissions factors</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">1.2 Service Availability</h4>
              <p className="text-muted-foreground">
                The Service is available to users in Canada. We reserve the right to modify, suspend, 
                or discontinue any aspect of the Service at any time with reasonable notice to subscribers.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">1.3 Service Limitations</h4>
              <p className="text-muted-foreground">
                The analyses and projections provided by the Service are for planning purposes only and should not be considered 
                financial, legal, or professional advice. Actual results may vary based on market conditions, operational factors, 
                and other variables beyond the scope of our calculations.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 2: Subscription Terms */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              2. Subscription Terms
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">2.1 Subscription Tiers</h4>
              <p className="text-muted-foreground mb-2">We offer the following subscription plans:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li><strong>Small Fleet:</strong> $799 USD per month (10-50 vehicles)</li>
                <li><strong>Medium Fleet:</strong> $2,499 USD per month (51-200 vehicles)</li>
                <li><strong>Large Fleet:</strong> $4,999 USD per month (201+ vehicles)</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">2.2 Free Trial</h4>
              <p className="text-muted-foreground">
                New users are eligible for a 14-day free trial period. During the trial, you will have access to all features 
                of your selected plan tier. No payment information is required to start the trial. At the end of the trial period, 
                you must subscribe to continue using the Service.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">2.3 Billing</h4>
              <p className="text-muted-foreground">
                Subscriptions are billed monthly in advance. Payments are processed through Stripe, our third-party payment processor. 
                By subscribing, you authorize us to charge your designated payment method on a recurring monthly basis until cancelled.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">2.4 Cancellation</h4>
              <p className="text-muted-foreground">
                You may cancel your subscription at any time through your account settings. Upon cancellation, you will retain 
                access to the Service until the end of your current billing period. No refunds will be provided for partial months. 
                See our <Link to="/refund" className="text-primary hover:underline">Refund Policy</Link> for more details.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">2.5 Plan Changes</h4>
              <p className="text-muted-foreground">
                You may upgrade or downgrade your subscription tier at any time. Upgrades take effect immediately with prorated 
                billing. Downgrades take effect at the start of the next billing cycle.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: User Responsibilities */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              3. User Responsibilities and Acceptable Use
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">3.1 Account Registration</h4>
              <p className="text-muted-foreground">
                You must provide accurate, complete, and current information when creating an account. You are responsible for 
                maintaining the confidentiality of your account credentials and for all activities that occur under your account.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">3.2 Acceptable Use</h4>
              <p className="text-muted-foreground mb-2">You agree to use the Service only for lawful purposes and in accordance with these Terms. You shall not:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Use the Service for any illegal or unauthorized purpose</li>
                <li>Attempt to gain unauthorized access to any portion of the Service</li>
                <li>Interfere with or disrupt the integrity or performance of the Service</li>
                <li>Reverse engineer, decompile, or disassemble any aspect of the Service</li>
                <li>Use automated systems to access the Service without our permission</li>
                <li>Share your account credentials with third parties</li>
                <li>Resell, sublicense, or redistribute the Service without authorization</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">3.3 Data Accuracy</h4>
              <p className="text-muted-foreground">
                You are responsible for the accuracy and completeness of any data you input into the Service. We are not liable 
                for any decisions made based on inaccurate or incomplete data provided by you.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 4: Intellectual Property */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              4. Intellectual Property
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">4.1 Our Intellectual Property</h4>
              <p className="text-muted-foreground">
                The Service, including all content, features, functionality, software, designs, text, graphics, logos, and 
                trademarks, is owned by H2Fleet Technologies Inc. and is protected by Canadian and international intellectual 
                property laws. Nothing in these Terms grants you any right, title, or interest in the Service except for the 
                limited license to use the Service as described herein.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">4.2 Your Data</h4>
              <p className="text-muted-foreground">
                You retain all rights to the data you input into the Service. By using the Service, you grant us a limited 
                license to use, process, and store your data solely for the purpose of providing the Service to you.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">4.3 Feedback</h4>
              <p className="text-muted-foreground">
                If you provide us with feedback, suggestions, or ideas regarding the Service, you grant us a perpetual, 
                irrevocable, royalty-free license to use and incorporate such feedback without compensation or attribution.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 5: Liability Limitations */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-primary" />
              5. Limitation of Liability
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">5.1 Disclaimer of Warranties</h4>
              <p className="text-muted-foreground">
                THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, 
                INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND 
                NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR COMPLETELY SECURE.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">5.2 Limitation of Liability</h4>
              <p className="text-muted-foreground">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, H2FLEET SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, 
                CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, OR 
                OTHER INTANGIBLE LOSSES, RESULTING FROM YOUR USE OF OR INABILITY TO USE THE SERVICE.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">5.3 Cap on Liability</h4>
              <p className="text-muted-foreground">
                Our total liability to you for any claims arising from or related to these Terms or your use of the Service 
                shall not exceed the amount you paid to us in the twelve (12) months preceding the claim.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 6: Dispute Resolution */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              6. Dispute Resolution and Governing Law
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">6.1 Governing Law</h4>
              <p className="text-muted-foreground">
                These Terms shall be governed by and construed in accordance with the laws of the Province of Ontario, Canada, 
                without regard to its conflict of law provisions.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">6.2 Dispute Resolution</h4>
              <p className="text-muted-foreground">
                Any dispute arising out of or relating to these Terms or the Service shall first be attempted to be resolved 
                through good-faith negotiation between the parties. If negotiation fails, the dispute shall be submitted to 
                binding arbitration in Toronto, Ontario, Canada, in accordance with the rules of the ADR Institute of Canada.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">6.3 Class Action Waiver</h4>
              <p className="text-muted-foreground">
                You agree to resolve any disputes with us on an individual basis and waive your right to participate in any 
                class action or representative proceeding.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 7: Termination */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Ban className="h-5 w-5 text-primary" />
              7. Termination
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">7.1 Termination by You</h4>
              <p className="text-muted-foreground">
                You may terminate your account at any time by cancelling your subscription and contacting us to request 
                account deletion. Upon termination, your right to use the Service will cease immediately.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">7.2 Termination by Us</h4>
              <p className="text-muted-foreground">
                We may terminate or suspend your access to the Service immediately, without prior notice, if you breach 
                these Terms or engage in conduct that we determine, in our sole discretion, is harmful to us, other users, 
                or third parties.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">7.3 Effect of Termination</h4>
              <p className="text-muted-foreground">
                Upon termination, you may request an export of your data within 30 days. After this period, we reserve the 
                right to delete your data in accordance with our data retention policies. Sections 4, 5, 6, and 8 shall 
                survive termination.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Section 8: General Provisions */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>8. General Provisions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">8.1 Entire Agreement</h4>
              <p className="text-muted-foreground">
                These Terms, together with our Privacy Policy and Refund Policy, constitute the entire agreement between 
                you and H2Fleet regarding the Service and supersede all prior agreements and understandings.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">8.2 Modifications</h4>
              <p className="text-muted-foreground">
                We reserve the right to modify these Terms at any time. We will provide notice of material changes by posting 
                the updated Terms on our website and updating the "Last Updated" date. Your continued use of the Service after 
                such modifications constitutes acceptance of the updated Terms.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">8.3 Severability</h4>
              <p className="text-muted-foreground">
                If any provision of these Terms is found to be unenforceable, the remaining provisions shall remain in full 
                force and effect.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">8.4 Contact Information</h4>
              <p className="text-muted-foreground">
                For questions about these Terms, please contact us at:
              </p>
              <p className="text-muted-foreground mt-2">
                H2Fleet Technologies Inc.<br />
                Email: contact@h2fleet.ca<br />
                Montreal, Quebec, Canada
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Related Links */}
        <div className="flex flex-wrap gap-4 mt-8">
          <Link to="/privacy">
            <Button variant="outline">Privacy Policy</Button>
          </Link>
          <Link to="/refund">
            <Button variant="outline">Refund Policy</Button>
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

export default Terms;