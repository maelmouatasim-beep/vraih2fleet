import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';

interface TelematicsConnection {
  id: string;
  provider: string;
  database: string | null;
  username: string;
  encrypted_credentials: string;
}

interface ReauthState {
  isRequired: boolean;
  connection: TelematicsConnection | null;
  onSuccess?: () => void;
}

export function useTelematicsAuth() {
  const { t } = useTranslation();
  const [reauthState, setReauthState] = useState<ReauthState>({
    isRequired: false,
    connection: null,
  });
  const [isReauthenticating, setIsReauthenticating] = useState(false);

  const checkSessionExpired = useCallback((response: any): boolean => {
    if (response?.error === 'SESSION_EXPIRED' || response?.requiresReauth) {
      return true;
    }
    // Geotab specific error patterns
    if (response?.error?.includes?.('InvalidCredentials') || 
        response?.error?.includes?.('session') ||
        response?.error?.includes?.('Session')) {
      return true;
    }
    return false;
  }, []);

  const promptReauth = useCallback((connection: TelematicsConnection, onSuccess?: () => void) => {
    setReauthState({
      isRequired: true,
      connection,
      onSuccess,
    });
  }, []);

  const dismissReauth = useCallback(() => {
    setReauthState({
      isRequired: false,
      connection: null,
    });
  }, []);

  const reauthenticate = useCallback(async (
    password: string,
    database?: string
  ): Promise<boolean> => {
    if (!reauthState.connection) return false;

    setIsReauthenticating(true);
    
    try {
      const { connection } = reauthState;
      
      // Re-authenticate with the provider
      const { data: authData, error: authError } = await supabase.functions.invoke('authenticate-telematics', {
        body: { 
          provider: connection.provider, 
          database: connection.provider === 'geotab' ? (database || connection.database) : null,
          username: connection.username, 
          password 
        }
      });

      if (authError) throw authError;

      if (!authData.success) {
        toast.error(authData.error || t('telematics.reauth.failed'));
        return false;
      }

      // Update the connection with new credentials
      const { error: updateError } = await supabase
        .from('telematics_connections')
        .update({
          encrypted_credentials: authData.credentials,
          last_sync_at: new Date().toISOString()
        })
        .eq('id', connection.id);

      if (updateError) throw updateError;

      toast.success(t('telematics.reauth.success'));
      
      // Call the success callback if provided
      if (reauthState.onSuccess) {
        reauthState.onSuccess();
      }
      
      dismissReauth();
      return true;
    } catch (error: any) {
      console.error('Reauthentication error:', error);
      toast.error(error.message || t('telematics.reauth.failed'));
      return false;
    } finally {
      setIsReauthenticating(false);
    }
  }, [reauthState, t, dismissReauth]);

  return {
    reauthState,
    isReauthenticating,
    checkSessionExpired,
    promptReauth,
    dismissReauth,
    reauthenticate,
  };
}
