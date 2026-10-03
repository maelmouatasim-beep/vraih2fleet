/**
 * Barrière d'erreur des notifications : un bug de rendu dans la cloche (ou
 * la liste) n'emporte plus la page — on affiche une cloche « indisponible »
 * qui retente au clic.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";
import { BellOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

function ClocheIndisponible({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onRetry}
      title={t("notifications.unavailable")}
      aria-label={t("notifications.unavailable")}
      data-testid="notifications-unavailable"
    >
      <BellOff className="w-5 h-5 text-muted-foreground" />
    </Button>
  );
}

interface Props {
  children: ReactNode;
  /** Rendu de repli personnalisé (sinon : cloche indisponible). */
  fallback?: (retry: () => void) => ReactNode;
}

export class NotificationsBoundary extends Component<Props, { erreur: boolean }> {
  state = { erreur: false };

  static getDerivedStateFromError() {
    return { erreur: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Notifications : erreur de rendu", error, info.componentStack);
  }

  private retry = () => this.setState({ erreur: false });

  render() {
    if (this.state.erreur) {
      return this.props.fallback ? this.props.fallback(this.retry) : <ClocheIndisponible onRetry={this.retry} />;
    }
    return this.props.children;
  }
}
