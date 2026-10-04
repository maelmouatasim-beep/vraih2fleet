import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { NotificationsProvider } from "@/hooks/useNotifications";
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
import Methodology from "./pages/Methodology";
import CaseStudies from "./pages/CaseStudies";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AuthRedirectHandler from "@/components/auth/AuthRedirectHandler";
import Projects from "./pages/Projects";
import MyFleet from "./pages/MyFleet";
import Library from "./pages/Library";
import OrganizationPage from "./pages/OrganizationPage";
import ProjectJourney, { ETAPES_PARCOURS } from "./pages/project/ProjectJourney";
import ApiDocumentation from "./pages/ApiDocumentation";

import Settings from "./pages/Settings";
import HelpTraining from "./pages/HelpTraining";
import Telematics from "./pages/Telematics";
import RoadmapBuilder from "./pages/RoadmapBuilder";
import Notifications from "./pages/Notifications";
import NotFound from "./pages/NotFound";
import OAuthConsent from "./pages/OAuthConsent";

import Guides from "./pages/Guides";
import { REDIRECTIONS_PUBLIQUES } from "./lib/production/site";
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
        <AuthRedirectHandler />
        <SubscriptionProvider>
        <NotificationsProvider>
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
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/refund" element={<Refund />} />
            <Route path="/methodology" element={<Methodology />} />
            <Route path="/case-studies" element={<CaseStudies />} />
            {/* Pages publiques retirées (refonte 2f, Phase 4) : une seule liste,
                aussi rendue en 301 côté serveur (dist/_redirects). */}
            {REDIRECTIONS_PUBLIQUES.map((r) => (
              <Route key={r.de} path={r.de} element={<Navigate to={r.vers} replace />} />
            ))}
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

            {/* Protected routes — menu 6 entrées */}
            <Route path="/dashboard" element={
              <ProtectedRoute><Dashboard /></ProtectedRoute>
            } />
            <Route path="/dashboard/projects" element={
              <ProtectedRoute><Projects /></ProtectedRoute>
            } />
            <Route path="/dashboard/fleet" element={
              <ProtectedRoute><MyFleet /></ProtectedRoute>
            } />
            <Route path="/dashboard/library" element={
              <ProtectedRoute><Library /></ProtectedRoute>
            } />
            <Route path="/dashboard/organization" element={
              <ProtectedRoute><OrganizationPage /></ProtectedRoute>
            } />
            <Route path="/dashboard/help" element={
              <ProtectedRoute><HelpTraining /></ProtectedRoute>
            } />

            {/* Parcours projet en 7 étapes */}
            {/* D4 : l'ancienne fiche projet (scénarios, anciens PDF, roadmap) est remplacée par le parcours */}
            <Route path="/dashboard/projects/:projectId" element={<ProjetVersParcours />} />
            {ETAPES_PARCOURS.map((etape) => (
              <Route
                key={etape}
                path={`/dashboard/projects/:projectId/${etape}`}
                element={<ProtectedRoute><ProjectJourney etape={etape} /></ProtectedRoute>}
              />
            ))}
            <Route path="/dashboard/projects/:projectId/compare" element={<ScenarioVersStrategies />} />
            {/* Ancien flux de scénarios (moteur supprimé au bloc 3) : l'étape Stratégies le remplace */}
            <Route path="/dashboard/projects/:projectId/scenarios/new" element={<ScenarioVersStrategies />} />
            <Route path="/dashboard/projects/:projectId/scenarios/new-flexible" element={<ScenarioVersStrategies />} />
            <Route path="/dashboard/scenarios/:scenarioId/results" element={<Navigate to="/dashboard/projects" replace />} />

            {/* Outils conservés, accessibles hors menu (absorbés au fil de la Phase 3) */}
            {/* D2 : anciennes données de référence / personnalisées, lues par
                aucun calcul du moteur — redirigées vers le registre (aucune
                donnée supprimée en base). */}
            <Route path="/dashboard/donnees-ref" element={<Navigate to="/dashboard/library" replace />} />
            <Route path="/dashboard/custom-data" element={<Navigate to="/dashboard/library" replace />} />
            <Route path="/dashboard/telematics" element={
              <ProtectedRoute><Telematics /></ProtectedRoute>
            } />
            <Route path="/dashboard/infrastructure" element={<Navigate to="/dashboard/projects" replace />} />
            {/* D4 : Analytics lisait les anciens scénarios, pas le moteur — les résultats vivent dans le parcours */}
            <Route path="/dashboard/analytics" element={<Navigate to="/dashboard/projects" replace />} />
            <Route path="/dashboard/roadmap" element={
              <ProtectedRoute><RoadmapBuilder /></ProtectedRoute>
            } />
            <Route path="/dashboard/wizard" element={<Navigate to="/dashboard/projects" replace />} />
            {/* Ancienne page Support (délais de réponse garantis, rappel téléphonique : non livrés) → Aide. */}
            <Route path="/dashboard/support" element={<Navigate to="/dashboard/help" replace />} />
            <Route path="/dashboard/notifications" element={
              <ProtectedRoute><Notifications /></ProtectedRoute>
            } />
            {PUBLIC_API_ENABLED && (
              <Route path="/dashboard/api" element={
                <ProtectedRoute><ApiDocumentation /></ProtectedRoute>
              } />
            )}
            <Route path="/dashboard/settings" element={
              <ProtectedRoute><Settings /></ProtectedRoute>
            } />

            {/* Modules retirés (refonte 2f) : redirections, aucune donnée supprimée */}
            <Route path="/dashboard/scenarios" element={<Navigate to="/dashboard/projects" replace />} />
            <Route path="/dashboard/scenarios/new" element={<Navigate to="/dashboard/projects" replace />} />
            <Route path="/dashboard/subsidies" element={<Navigate to="/dashboard/projects" replace />} />
            <Route path="/dashboard/incentives" element={<Navigate to="/dashboard/projects" replace />} />
            <Route path="/dashboard/suppliers" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard/admin" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard/projects/:projectId/tasks" element={<TacheVersSuivi />} />

            {/* Catch-all */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          </TooltipProvider>
        </NotificationsProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </Router>
  </QueryClientProvider>
);

// Le kanban autonome est intégré à l'étape « Suivi » du parcours projet.
function TacheVersSuivi() {
  const { projectId } = useParams();
  return <Navigate to={`/dashboard/projects/${projectId}/suivi`} replace />;
}

// L'ancien flux de création de scénarios est remplacé par l'étape Stratégies.
function ProjetVersParcours() {
  const { projectId } = useParams();
  return <Navigate to={`/dashboard/projects/${projectId}/flotte`} replace />;
}

function ScenarioVersStrategies() {
  const { projectId } = useParams();
  return <Navigate to={`/dashboard/projects/${projectId}/strategies`} replace />;
}

export default App;
