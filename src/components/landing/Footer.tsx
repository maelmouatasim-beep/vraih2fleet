import { useTranslation } from 'react-i18next';
import { Link } from "react-router-dom";
import { Leaf, Linkedin, Twitter, Github } from "lucide-react";

const Footer = () => {
  const { t } = useTranslation();

  const footerLinks = {
    product: [
      { labelKey: "landing.footer.links.features", href: "/features" },
      { labelKey: "landing.footer.links.roadmap", href: "/roadmap" },
      { labelKey: "landing.footer.links.changelog", href: "/changelog" },
    ],
    resources: [
      { labelKey: "landing.footer.links.documentation", href: "/docs" },
      { labelKey: "landing.footer.links.guides", href: "/guides" },
      { labelKey: "landing.footer.links.apiReference", href: "/api" },
      { labelKey: "landing.footer.links.caseStudies", href: "/case-studies" },
    ],
    company: [
      { labelKey: "landing.footer.links.about", href: "/about" },
      { labelKey: "landing.footer.links.contact", href: "/contact" },
      { labelKey: "landing.footer.links.careers", href: "/careers" },
      { labelKey: "landing.footer.links.press", href: "/press" },
    ],
    legal: [
      { labelKey: "landing.footer.links.terms", href: "/terms" },
      { labelKey: "landing.footer.links.privacy", href: "/privacy" },
      { labelKey: "landing.footer.links.refund", href: "/refund" },
    ],
  };

  return (
    <footer className="bg-foreground py-16">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
                <Leaf className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold text-background">H2Fleet</span>
            </Link>
            <p className="text-muted-foreground text-sm mb-6">
              {t('landing.footer.description')}
            </p>
            <div className="flex gap-4">
              <a 
                href="https://linkedin.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <Linkedin className="w-4 h-4" />
              </a>
              <a 
                href="https://twitter.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <Twitter className="w-4 h-4" />
              </a>
              <a 
                href="https://github.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
              >
                <Github className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Product links */}
          <div>
            <h4 className="font-semibold text-background mb-4">{t('landing.footer.product')}</h4>
            <ul className="space-y-3">
              {footerLinks.product.map((link) => (
                <li key={link.href}>
                  <Link 
                    to={link.href}
                    className="text-muted-foreground text-sm hover:text-background transition-colors"
                  >
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources links */}
          <div>
            <h4 className="font-semibold text-background mb-4">{t('landing.footer.resources')}</h4>
            <ul className="space-y-3">
              {footerLinks.resources.map((link) => (
                <li key={link.href}>
                  <Link 
                    to={link.href}
                    className="text-muted-foreground text-sm hover:text-background transition-colors"
                  >
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company links */}
          <div>
            <h4 className="font-semibold text-background mb-4">{t('landing.footer.company')}</h4>
            <ul className="space-y-3">
              {footerLinks.company.map((link) => (
                <li key={link.href}>
                  <Link 
                    to={link.href}
                    className="text-muted-foreground text-sm hover:text-background transition-colors"
                  >
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal links */}
          <div>
            <h4 className="font-semibold text-background mb-4">{t('landing.footer.legal')}</h4>
            <ul className="space-y-3">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link 
                    to={link.href}
                    className="text-muted-foreground text-sm hover:text-background transition-colors"
                  >
                    {t(link.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-muted">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-muted-foreground text-sm">
              {t('landing.footer.copyright', { year: new Date().getFullYear() })}
            </p>
            <p className="text-muted-foreground text-sm">
              {t('landing.footer.madeWith')}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
