import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe } from 'lucide-react';
import { langueCourte, memoriserChoixLangue } from '@/i18n/preference';

// Français d'abord : produit québécois
const languages = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
] as const;

interface LanguageSelectorProps {
  variant?: 'default' | 'landing';
}

/** Sélecteur de langue (E3) : la langue courante est lue sur la langue
 *  RÉSOLUE (fr-CA → fr) et le choix est mémorisé explicitement. */
const LanguageSelector = ({ variant = 'default' }: LanguageSelectorProps) => {
  const { i18n, t } = useTranslation();
  const courante = langueCourte(i18n.resolvedLanguage ?? i18n.language);

  const choisir = (code: 'fr' | 'en') => {
    memoriserChoixLangue(typeof window !== 'undefined' ? window.localStorage : null, code);
    void i18n.changeLanguage(code);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={t('common.languageLabel')}
          className={variant === 'landing'
            ? "text-primary-foreground hover:bg-primary-foreground/10 gap-2"
            : "gap-2"
          }
        >
          <Globe className="w-4 h-4" />
          <span>{courante.toUpperCase()}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {languages.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => choisir(lang.code)}
            className={courante === lang.code ? 'bg-accent' : ''}
            lang={lang.code}
          >
            {lang.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default LanguageSelector;
