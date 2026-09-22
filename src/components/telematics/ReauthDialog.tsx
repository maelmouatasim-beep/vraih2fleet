import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, AlertTriangle, KeyRound } from 'lucide-react';

interface ReauthDialogProps {
  isOpen: boolean;
  provider: string;
  username: string;
  database?: string | null;
  isLoading: boolean;
  onReauth: (password: string, database?: string) => Promise<boolean>;
  onClose: () => void;
}

const ReauthDialog = ({
  isOpen,
  provider,
  username,
  database,
  isLoading,
  onReauth,
  onClose,
}: ReauthDialogProps) => {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [newDatabase, setNewDatabase] = useState(database || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onReauth(password, provider === 'geotab' ? newDatabase : undefined);
    if (success) {
      setPassword('');
    }
  };

  const providerName = provider.charAt(0).toUpperCase() + provider.slice(1);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <DialogTitle>{t('telematics.reauth.sessionExpired')}</DialogTitle>
              <DialogDescription>
                {t('telematics.reauth.pleaseReconnect', { provider: providerName })}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-muted-foreground">{t('telematics.reauth.account')}</Label>
            <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
              <KeyRound className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">{username}</span>
              <span className="text-xs text-muted-foreground">({providerName})</span>
            </div>
          </div>

          {provider === 'geotab' && (
            <div className="space-y-2">
              <Label htmlFor="reauth-database">{t('telematics.geotab.database')}</Label>
              <Input
                id="reauth-database"
                type="text"
                value={newDatabase}
                onChange={(e) => setNewDatabase(e.target.value)}
                placeholder="my_database"
                disabled={isLoading}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reauth-password">
              {provider === 'samsara' 
                ? t('telematics.samsara.apiToken') 
                : t('telematics.geotab.password')}
            </Label>
            <Input
              id="reauth-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={isLoading}
              autoFocus
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading || !password.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('common.loading')}
                </>
              ) : (
                t('telematics.reauth.reconnect')
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReauthDialog;
