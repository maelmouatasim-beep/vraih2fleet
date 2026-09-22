import { useState, useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Leaf, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import LanguageSelector from "@/components/LanguageSelector";
import { cn } from "@/lib/utils";
import DemoRequestModal from './DemoRequestModal';

interface DropdownItem {
  href: string;
  label: string;
}

interface NavDropdownProps {
  label: string;
  items: DropdownItem[];
  isLanding: boolean;
  isScrolled: boolean;
}

const NavDropdown = ({ label, items, isLanding, isScrolled }: NavDropdownProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setIsOpen(false);
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen(!isOpen);
    }
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={cn(
          "flex items-center gap-1 text-sm font-medium transition-colors",
          isLanding && !isScrolled 
            ? "text-primary-foreground/80 hover:text-primary-foreground" 
            : "text-muted-foreground hover:text-primary"
        )}
      >
        {label}
        <ChevronDown className={cn(
          "w-4 h-4 transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </button>

      <div
        className={cn(
          "absolute top-full left-0 mt-2 min-w-[180px] bg-popover border border-border rounded-lg shadow-lg overflow-hidden z-50",
          "transform transition-all duration-200 origin-top",
          isOpen 
            ? "opacity-100 scale-y-100 translate-y-0" 
            : "opacity-0 scale-y-95 -translate-y-1 pointer-events-none"
        )}
        role="menu"
      >
        {items.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            onClick={() => setIsOpen(false)}
            className="block px-4 py-2.5 text-sm text-foreground hover:bg-accent hover:text-accent-foreground transition-colors focus:bg-accent focus:outline-none"
            role="menuitem"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
};

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileDropdowns, setMobileDropdowns] = useState<Record<string, boolean>>({});
  const [isDemoModalOpen, setIsDemoModalOpen] = useState(false);
  const location = useLocation();
  const isLandingPage = location.pathname === "/";
  const { t } = useTranslation();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);


  const solutionsItems: DropdownItem[] = [
    { href: "/case-studies", label: t('landing.navbar.caseStudies') },
  ];

  const resourcesItems: DropdownItem[] = [
    { href: "/docs", label: t('landing.navbar.documentation') },
    { href: "/guides", label: t('landing.navbar.guides') },
  ];

  const toggleMobileDropdown = (key: string) => {
    setMobileDropdowns(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <>
      <header className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        isLandingPage && !isScrolled 
          ? "bg-transparent" 
          : "bg-background/95 backdrop-blur-md border-b border-border shadow-sm"
      )}>
        <div className="container mx-auto px-4">
          <nav className="flex items-center justify-between h-16 md:h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                isLandingPage && !isScrolled ? "bg-primary-foreground/20" : "gradient-hero"
              )}>
                <Leaf className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className={cn(
                "text-xl font-bold",
                isLandingPage && !isScrolled ? "text-primary-foreground" : "text-foreground"
              )}>
                H2Fleet
              </span>
            </Link>

            {/* Desktop navigation */}
            <div className="hidden md:flex items-center gap-8">
              <Link
                to="/features"
                className={cn(
                  "text-sm font-medium transition-colors",
                  isLandingPage && !isScrolled 
                    ? "text-primary-foreground/80 hover:text-primary-foreground" 
                    : "text-muted-foreground hover:text-primary"
                )}
              >
                {t('landing.navbar.features')}
              </Link>
              <NavDropdown 
                label={t('landing.navbar.solutions')} 
                items={solutionsItems}
                isLanding={isLandingPage}
                isScrolled={isScrolled}
              />
              <NavDropdown 
                label={t('landing.navbar.resources')} 
                items={resourcesItems}
                isLanding={isLandingPage}
                isScrolled={isScrolled}
              />
            </div>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center gap-3">
              <LanguageSelector variant={isLandingPage && !isScrolled ? "landing" : "default"} />
              <Button 
                variant="outline" 
                asChild
                className={cn(
                  "border-border",
                  isLandingPage && !isScrolled 
                    ? "border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10" 
                    : "hover:bg-muted"
                )}
              >
                <Link to="/login">{t('landing.navbar.login')}</Link>
              </Button>
              <Button 
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => setIsDemoModalOpen(true)}
              >
                {t('landing.navbar.startTrial')}
              </Button>
            </div>

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2"
              aria-label="Toggle menu"
              aria-expanded={isMobileMenuOpen}
            >
              {isMobileMenuOpen ? (
                <X className={cn(
                  "w-6 h-6",
                  isLandingPage && !isScrolled ? "text-primary-foreground" : "text-foreground"
                )} />
              ) : (
                <Menu className={cn(
                  "w-6 h-6",
                  isLandingPage && !isScrolled ? "text-primary-foreground" : "text-foreground"
                )} />
              )}
            </button>
          </nav>
        </div>
      </header>

      {/* Mobile menu overlay */}
      <div
        className={cn(
          "fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300",
          isMobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* Mobile menu sidebar */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-[280px] bg-background border-l border-border shadow-2xl z-50 md:hidden",
          "transform transition-transform duration-300 ease-out",
          isMobileMenuOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Close button */}
          <div className="flex justify-end p-4 border-b border-border">
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
              aria-label="Close menu"
            >
              <X className="w-5 h-5 text-foreground" />
            </button>
          </div>

          {/* Navigation links */}
          <div className="flex-1 overflow-y-auto py-4">
            {/* Features link */}
            <div className="px-4">
              <Link
                to="/features"
                className="block py-3 text-foreground font-medium hover:text-primary transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {t('landing.navbar.features')}
              </Link>
            </div>

            {/* Solutions dropdown */}
            <div className="px-4">
              <button
                onClick={() => toggleMobileDropdown('solutions')}
                className="flex items-center justify-between w-full py-3 text-foreground font-medium"
              >
                {t('landing.navbar.solutions')}
                <ChevronDown className={cn(
                  "w-4 h-4 transition-transform duration-200",
                  mobileDropdowns.solutions && "rotate-180"
                )} />
              </button>
              {mobileDropdowns.solutions && (
                <div className="pl-4 pb-2 space-y-1">
                  {solutionsItems.map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      className="block py-2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>


            {/* Resources dropdown */}
            <div className="px-4">
              <button
                onClick={() => toggleMobileDropdown('resources')}
                className="flex items-center justify-between w-full py-3 text-foreground font-medium"
              >
                {t('landing.navbar.resources')}
                <ChevronDown className={cn(
                  "w-4 h-4 transition-transform duration-200",
                  mobileDropdowns.resources && "rotate-180"
                )} />
              </button>
              {mobileDropdowns.resources && (
                <div className="pl-4 pb-2 space-y-1">
                  {resourcesItems.map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      className="block py-2 text-muted-foreground hover:text-foreground transition-colors"
                      onClick={() => setIsMobileMenuOpen(false)}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* CTA buttons */}
          <div className="p-4 space-y-3 border-t border-border">
            <LanguageSelector />
            <Button variant="outline" className="w-full" asChild>
              <Link to="/login">{t('landing.navbar.login')}</Link>
            </Button>
            <Button 
              className="w-full bg-primary hover:bg-primary/90"
              onClick={() => { setIsDemoModalOpen(true); setIsMobileMenuOpen(false); }}
            >
              {t('landing.navbar.startTrial')}
            </Button>
          </div>
        </div>
      </div>

      <DemoRequestModal 
        open={isDemoModalOpen} 
        onOpenChange={setIsDemoModalOpen} 
      />
    </>
  );
};

export default Navbar;
