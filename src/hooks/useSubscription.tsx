import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export type SubscriptionTier = 'free' | 'small' | 'medium' | 'large';
export type SubscriptionStatus = 'active' | 'trial' | 'canceled' | 'expired';

export type FeatureName = 
  | 'api_access'
  | 'custom_reference_data'
  | 'advanced_analytics'
  | 'priority_support'
  | 'sso'
  | 'custom_integrations';

// Demo mode flag - set to true to bypass all tier restrictions for testing
const DEMO_MODE = true;

// Vehicle limits per tier
const VEHICLE_LIMITS: Record<SubscriptionTier, number | null> = {
  free: 50,
  small: 50,
  medium: 200,
  large: null, // unlimited
};

interface Subscription {
  id: string;
  user_id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  fleet_size: number | null;
  trial_end_date: string | null;
  subscription_start_date: string | null;
  created_at: string;
  updated_at: string;
}

interface SubscriptionContextType {
  subscription: Subscription | null;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  isLoading: boolean;
  isTrialExpired: boolean;
  daysLeftInTrial: number | null;
  vehicleLimit: number | null;
  isUnlimited: boolean;
  canAccessFeature: (featureName: FeatureName) => boolean;
  isVehicleCountAllowed: (count: number) => boolean;
  refetch: () => Promise<void>;
}

// Feature access mapping by tier
const FEATURE_ACCESS: Record<FeatureName, SubscriptionTier[]> = {
  api_access: ['medium', 'large'],
  custom_reference_data: ['medium', 'large'],
  advanced_analytics: ['medium', 'large'],
  priority_support: ['medium', 'large'],
  sso: ['large'],
  custom_integrations: ['large'],
};

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscription = async () => {
    if (!user) {
      setSubscription(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Error fetching subscription:', error);
        setSubscription(null);
      } else {
        setSubscription(data as Subscription | null);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
      setSubscription(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, [user?.id]);

  // In demo mode, always use 'large' tier for full access
  const tier: SubscriptionTier = DEMO_MODE ? 'large' : (subscription?.tier as SubscriptionTier || 'free');
  const status: SubscriptionStatus = DEMO_MODE ? 'active' : (subscription?.status as SubscriptionStatus || 'trial');

  // Calculate trial expiration
  const isTrialExpired = (() => {
    if (DEMO_MODE) return false;
    if (status !== 'trial' || !subscription?.trial_end_date) return false;
    return new Date(subscription.trial_end_date) < new Date();
  })();

  const daysLeftInTrial = (() => {
    if (DEMO_MODE) return null;
    if (status !== 'trial' || !subscription?.trial_end_date) return null;
    const endDate = new Date(subscription.trial_end_date);
    const now = new Date();
    const diffTime = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  })();

  const canAccessFeature = (featureName: FeatureName): boolean => {
    // Demo mode grants access to all features
    if (DEMO_MODE) return true;
    
    // If trial expired, no access to premium features
    if (isTrialExpired && tier === 'free') return false;
    
    const allowedTiers = FEATURE_ACCESS[featureName];
    if (!allowedTiers) return false;
    
    return allowedTiers.includes(tier);
  };

  // Vehicle limit based on tier (demo mode = unlimited)
  const vehicleLimit = DEMO_MODE ? null : VEHICLE_LIMITS[tier];
  const isUnlimited = vehicleLimit === null;

  const isVehicleCountAllowed = (count: number): boolean => {
    if (DEMO_MODE || isUnlimited) return true;
    return count <= (vehicleLimit || 0);
  };

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        tier,
        status,
        isLoading,
        isTrialExpired,
        daysLeftInTrial,
        vehicleLimit,
        isUnlimited,
        canAccessFeature,
        isVehicleCountAllowed,
        refetch: fetchSubscription,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = (): SubscriptionContextType => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};

// Export vehicle limits for external use
export { VEHICLE_LIMITS };
