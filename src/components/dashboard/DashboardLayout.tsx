import { useState } from "react";
import { AssistantWidget } from "@/components/AssistantWidget";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PUBLIC_API_ENABLED } from "@/lib/constants";
import {
  LayoutDashboard,
  FolderKanban, 
  BarChart3, 
  Settings,
  LogOut,
  ChevronLeft,
  Search,
  Leaf,
  Plus,
  Database,
  FileJson,
  Headphones,
  TrendingUp,
  Code,
  Loader2,
  Building2,
  Plug,
  Banknote,
  GraduationCap,
  Map
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import LanguageSelector from "@/components/LanguageSelector";
import { NotificationsDropdown } from "@/components/notifications";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { t } = useTranslation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, role, signOut } = useAuth();

  // SECTION 1 - Main workflow
  const mainLinks = [
    { icon: LayoutDashboard, labelKey: "dashboard.menu.dashboard", href: "/dashboard" },
    { icon: FolderKanban, labelKey: "dashboard.menu.projects", href: "/dashboard/projects" },
    { icon: BarChart3, labelKey: "dashboard.menu.scenarios", href: "/dashboard/scenarios" },
    { icon: TrendingUp, labelKey: "dashboard.menu.analytics", href: "/dashboard/analytics" },
    { icon: Building2, labelKey: "dashboard.menu.infrastructure", href: "/dashboard/infrastructure" },
    { icon: Map, labelKey: "dashboard.menu.roadmap", href: "/dashboard/roadmap" },
  ];

  // SECTION 2 - Data sources
  const dataLinks = [
    { icon: Plug, labelKey: "dashboard.menu.telematics", href: "/dashboard/telematics" },
    { icon: Database, labelKey: "dashboard.menu.referenceData", href: "/dashboard/donnees-ref" },
    { icon: FileJson, labelKey: "dashboard.menu.customData", href: "/dashboard/custom-data" },
    { icon: Building2, labelKey: "dashboard.menu.suppliers", href: "/dashboard/suppliers" },
    { icon: Banknote, labelKey: "dashboard.menu.subsidies", href: "/dashboard/subsidies" },
  ];

  // SECTION 3 - Configuration
  const configLinks = [
    // API publique reportée : entrée masquée tant que le drapeau est éteint.
    ...(PUBLIC_API_ENABLED
      ? [{ icon: Code, labelKey: "dashboard.menu.api", href: "/dashboard/api" }]
      : []),
    { icon: GraduationCap, labelKey: "dashboard.menu.helpTraining", href: "/dashboard/help" },
    { icon: Headphones, labelKey: "dashboard.menu.support", href: "/dashboard/support" },
  ];

  const handleNewProject = () => {
    navigate("/dashboard/projects?create=true");
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await signOut();
    toast({
      title: t('dashboard.logout.success'),
      description: t('dashboard.logout.message'),
    });
    navigate("/login");
  };

  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  const displayName = profile?.full_name || user?.email || "Utilisateur";
  const displayRole = role === "admin" ? t('dashboard.user.admin') : t('dashboard.user.user');

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside 
        className={`fixed left-0 top-0 bottom-0 bg-sidebar z-40 flex flex-col transition-all duration-300 ${
          sidebarCollapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          {!sidebarCollapsed && (
            <Link to="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
                <Leaf className="w-4 h-4 text-sidebar-primary-foreground" />
              </div>
              <span className="font-bold text-sidebar-foreground">H2Fleet</span>
            </Link>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <ChevronLeft className={`w-4 h-4 transition-transform ${sidebarCollapsed ? "rotate-180" : ""}`} />
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-2 overflow-y-auto">
          {/* Section 1: Main workflow */}
          <div className="space-y-1">
            {mainLinks.map((link) => {
              const isActive = location.pathname === link.href;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  } ${sidebarCollapsed ? "justify-center" : ""}`}
                >
                  <link.icon className="w-5 h-5 flex-shrink-0" />
                  {!sidebarCollapsed && (
                    <span className="font-medium text-sm">{t(link.labelKey)}</span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Separator */}
          <div className={`my-3 ${sidebarCollapsed ? "mx-2" : "mx-3"}`}>
            <div className="border-t border-sidebar-border" />
          </div>

          {/* Section 2: Data sources */}
          <div className="space-y-1">
            {dataLinks.map((link) => {
              const isActive = location.pathname === link.href;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  } ${sidebarCollapsed ? "justify-center" : ""}`}
                >
                  <link.icon className="w-5 h-5 flex-shrink-0" />
                  {!sidebarCollapsed && (
                    <span className="font-medium text-sm">{t(link.labelKey)}</span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Separator */}
          <div className={`my-3 ${sidebarCollapsed ? "mx-2" : "mx-3"}`}>
            <div className="border-t border-sidebar-border" />
          </div>

          {/* Section 3: Configuration */}
          <div className="space-y-1">
            {configLinks.map((link) => {
              const isActive = location.pathname === link.href;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                      : "text-sidebar-foreground hover:bg-sidebar-accent"
                  } ${sidebarCollapsed ? "justify-center" : ""}`}
                >
                  <link.icon className="w-5 h-5 flex-shrink-0" />
                  {!sidebarCollapsed && (
                    <span className="font-medium text-sm">{t(link.labelKey)}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Bottom section */}
        <div className="p-2 border-t border-sidebar-border space-y-1">
          <Link
            to="/dashboard/settings"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors ${
              sidebarCollapsed ? "justify-center" : ""
            }`}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            {!sidebarCollapsed && <span className="font-medium text-sm">{t('dashboard.menu.settings')}</span>}
          </Link>
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors ${
              sidebarCollapsed ? "justify-center" : ""
            }`}
          >
            {isLoggingOut ? (
              <Loader2 className="w-5 h-5 flex-shrink-0 animate-spin" />
            ) : (
              <LogOut className="w-5 h-5 flex-shrink-0" />
            )}
            {!sidebarCollapsed && (
              <span className="font-medium text-sm">
                {isLoggingOut ? t('dashboard.menu.loggingOut') : t('dashboard.menu.logout')}
              </span>
            )}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${
        sidebarCollapsed ? "ml-16" : "ml-64"
      }`}>
        {/* Top bar */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input 
                placeholder={t('dashboard.header.search')}
                className="pl-9 w-64 bg-secondary border-0"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="default" size="sm" className="gap-2" onClick={handleNewProject}>
              <Plus className="w-4 h-4" />
              {t('dashboard.header.newProject')}
            </Button>
            
            <LanguageSelector />
            
            <NotificationsDropdown />
            
            <div className="flex items-center gap-3 pl-4 border-l border-border">
              <Avatar className="w-8 h-8">
                <AvatarImage src={profile?.avatar_url || ""} />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block">
                <p className="text-sm font-medium text-foreground truncate max-w-[150px]">
                  {displayName}
                </p>
                <p className="text-xs text-muted-foreground">{displayRole}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>

      {/* AI Assistant Widget */}
      <AssistantWidget />
    </div>
  );
};

export default DashboardLayout;
