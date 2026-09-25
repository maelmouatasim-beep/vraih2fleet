import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import ScrollToTop from "@/components/ScrollToTop";
import { PUBLIC_API_ENABLED } from "@/lib/constants";
import { SubscriptionProvider } from "@/hooks/useSubscription";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Index from "./pages/Index";
import Features from "./pages/Features";

import About from "./pages/About";
import Contact from "./pages/Contact";
import Terms from "./pages/Terms";
import Privacy from "./pages/Privacy";
import Refund from "./pages/Refund";
import Roadmap from "./pages/Roadmap";
import Changelog from "./pages/Changelog";
import Methodology from "./pages/Methodology";
import Docs from "./pages/Docs";
import Api from "./pages/Api";
import CaseStudies from "./pages/CaseStudies";
import Careers from "./pages/Careers";
import Press from "./pages/Press";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import ScenarioDetail from "./pages/ScenarioDetail";
import NewScenario from "./pages/NewScenario";
import NewFlexibleScenario from "./pages/NewFlexibleScenario";
import ScenarioResults from "./pages/ScenarioResults";
import Scenarios from "./pages/Scenarios";
import Admin from "./pages/Admin";
import DonneesRef from "./pages/DonneesRef";
import CustomReferenceData from "./pages/CustomReferenceData";
import Support from "./pages/Support";
import Analytics from "./pages/Analytics";
import ApiDocumentation from "./pages/ApiDocumentation";

import Settings from "./pages/Settings";
import HelpTraining from "./pages/HelpTraining";
import IncentivesPage from "./pages/IncentivesPage";
import SuppliersPage from "./pages/SuppliersPage";
import Ecosystem from "./pages/Ecosystem";
import Telematics from "./pages/Telematics";
import Infrastructure from "./pages/Infrastructure";
import Subsidies from "./pages/Subsidies";
import ScenarioComparison from "./pages/ScenarioComparison";
import RoadmapBuilder from "./pages/RoadmapBuilder";
import TaskBoardPage from "./pages/TaskBoardPage";
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound";
import OAuthConsent from "./pages/OAuthConsent";

import Guides from "./pages/Guides";
import TransitionWizard from "./pages/TransitionWizard";
import { GuideBEV, GuideFCEV, GuideBiomethane, GuideSectorUrban, GuideSectorRegional, GuideSectorLongHaul, GuidePlanning, GuideFunding, GuideOperations } from "./pages/guides";

const queryClient = new QueryClient();

// L'aperçu hébergé (claude.ai) sert l'app hors de la racine "/" : le hash
// routing garde alors toutes les routes fonctionnelles. La prod reste en
// BrowserRouter (URLs propres).
const Router = import.meta.env.VITE_PREVIEW_HASH_ROUTER === "true" ? HashRouter : BrowserRouter;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <Router>
      <ScrollToTop />
      <AuthProvider>
        <SubscriptionProvider>
          <TooltipProvider delayDuration={0}>
          <Toaster />
          <Sonner />
          <Routes>
            {/* Public routes */}
            <Route path="/.lovable/oauth/consent" element={<OAuthConsent />} />
            <Route path="/" element={<Index />} />

            <Route path="/features" element={<Features />} />
            
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/refund" element={<Refund />} />
            <Route path="/roadmap" element={<Roadmap />} />
            <Route path="/changelog" element={<Changelog />} />
            <Route path="/methodology" element={<Methodology />} />
            <Route path="/docs" element={<Docs />} />
            <Route path="/api" element={<Api />} />
            <Route path="/case-studies" element={<CaseStudies />} />
            <Route path="/careers" element={<Careers />} />
            <Route path="/press" element={<Press />} />
            <Route path="/ecosystem" element={<Ecosystem />} />
            <Route path="/calculator" element={<Navigate to="/features" replace />} />
            <Route path="/guides" element={<Guides />} />
            <Route path="/guides/technology/bev" element={<GuideBEV />} />
            <Route path="/guides/technology/fcev" element={<GuideFCEV />} />
            <Route path="/guides/technology/biomethane" element={<GuideBiomethane />} />
            <Route path="/guides/sectors/urban" element={<GuideSectorUrban />} />
            <Route path="/guides/sectors/regional" element={<GuideSectorRegional />} />
            <Route path="/guides/sectors/long-haul" element={<GuideSectorLongHaul />} />
            <Route path="/guides/planning" element={<GuidePlanning />} />
            <Route path="/guides/funding" element={<GuideFunding />} />
            <Route path="/guides/operations" element={<GuideOperations />} />
            
            {/* Protected routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute><Dashboard /></ProtectedRoute>
            } />
            <Route path="/dashboard/projects" element={
              <ProtectedRoute><Projects /></ProtectedRoute>
            } />
            <Route path="/dashboard/projects/:projectId" element={
              <ProtectedRoute><ProjectDetail /></ProtectedRoute>
            } />
            <Route path="/dashboard/projects/:projectId/scenarios/new" element={
              <ProtectedRoute><NewScenario /></ProtectedRoute>
            } />
            <Route path="/dashboard/projects/:projectId/scenarios/new-flexible" element={
              <ProtectedRoute><NewFlexibleScenario /></ProtectedRoute>
            } />
            <Route path="/dashboard/scenarios" element={
              <ProtectedRoute><Scenarios /></ProtectedRoute>
            } />
            <Route path="/dashboard/projects/:projectId/compare" element={
              <ProtectedRoute><ScenarioComparison /></ProtectedRoute>
            } />
            <Route path="/dashboard/scenarios/:scenarioId" element={
              <ProtectedRoute><ScenarioDetail /></ProtectedRoute>
            } />
            <Route path="/dashboard/scenarios/:scenarioId/results" element={
              <ProtectedRoute><ScenarioResults /></ProtectedRoute>
            } />
            <Route path="/dashboard/admin" element={
              <ProtectedRoute><Admin /></ProtectedRoute>
            } />
            <Route path="/dashboard/donnees-ref" element={
              <ProtectedRoute><DonneesRef /></ProtectedRoute>
            } />
            <Route path="/dashboard/custom-data" element={
              <ProtectedRoute><CustomReferenceData /></ProtectedRoute>
            } />
            <Route path="/dashboard/support" element={
              <ProtectedRoute><Support /></ProtectedRoute>
            } />
            <Route path="/dashboard/analytics" element={
              <ProtectedRoute><Analytics /></ProtectedRoute>
            } />
            {PUBLIC_API_ENABLED && (
              <Route path="/dashboard/api" element={
                <ProtectedRoute><ApiDocumentation /></ProtectedRoute>
              } />
            )}
            <Route path="/dashboard/settings" element={
              <ProtectedRoute><Settings /></ProtectedRoute>
            } />
            <Route path="/dashboard/help" element={
              <ProtectedRoute><HelpTraining /></ProtectedRoute>
            } />
            <Route path="/dashboard/incentives" element={
              <ProtectedRoute><Subsidies /></ProtectedRoute>
            } />
            <Route path="/dashboard/suppliers" element={
              <ProtectedRoute><SuppliersPage /></ProtectedRoute>
            } />
            <Route path="/dashboard/telematics" element={
              <ProtectedRoute><Telematics /></ProtectedRoute>
            } />
            <Route path="/dashboard/infrastructure" element={
              <ProtectedRoute><Infrastructure /></ProtectedRoute>
            } />
            <Route path="/dashboard/subsidies" element={
              <ProtectedRoute><Subsidies /></ProtectedRoute>
            } />
            <Route path="/dashboard/roadmap" element={
              <ProtectedRoute><RoadmapBuilder /></ProtectedRoute>
            } />
            <Route path="/dashboard/projects/:projectId/tasks" element={
              <ProtectedRoute><TaskBoardPage /></ProtectedRoute>
            } />
            <Route path="/dashboard/notifications" element={
              <ProtectedRoute><Notifications /></ProtectedRoute>
            } />
            <Route path="/dashboard/wizard" element={
              <ProtectedRoute><TransitionWizard /></ProtectedRoute>
            } />
            <Route path="/dashboard/scenarios/new" element={
              <ProtectedRoute><NewScenario /></ProtectedRoute>
            } />
            
            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </TooltipProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </Router>
  </QueryClientProvider>
);

export default App;
