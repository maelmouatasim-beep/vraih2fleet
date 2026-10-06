import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { PAGE_CONFIRMATION, urlRetourAuth } from "@/lib/authRedirect";

interface Profile {
  id: string;
  full_name: string | null;
  company: string | null;
  avatar_url: string | null;
  function_title: string | null;
  fleet_size: string | null;
  fleet_types: string[] | null;
  newsletter_opt_in: boolean;
}

interface UserRole {
  role: 'admin' | 'user';
}

interface SignUpMetadata {
  full_name: string;
  /** Type d'organisme choisi à l'inscription (revue B6) : pilote le
   *  type de l'organisation créée automatiquement. */
  org_type?: string;
  // Optionnels : le profil se complète après la première connexion
  // (ProfileOnboardingDialog), plus au signup.
  company?: string;
  function_title?: string;
  fleet_size?: string;
  fleet_types?: string[];
  newsletter_opt_in?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  role: 'admin' | 'user' | null;
  isLoading: boolean;
  signUp: (email: string, password: string, metadata: SignUpMetadata) => Promise<{ error: Error | null; confirmationRequise: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  /** Relit la session stockée (ex. confirmée dans un autre onglet) et met à
   *  jour CE fournisseur : seule source de vérité de l'utilisateur connecté. */
  synchroniserSession: () => Promise<Session | null>;
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<'admin' | 'user' | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    
    if (!error && data) {
      setProfile(data as Profile);
    }
  };

  const fetchRole = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (!error && data) {
      setRole(data.role as 'admin' | 'user');
    }
  };

  // Même mise à jour quelle que soit l'origine de la session (événement
  // d'authentification, relais entre onglets, relecture du stockage).
  const appliquerSession = useCallback((session: Session | null) => {
    setSession(session);
    setUser(session?.user ?? null);
    if (session?.user) {
      const id = session.user.id;
      // Appels Supabase différés hors du rappel d'authentification.
      setTimeout(() => {
        fetchProfile(id);
        fetchRole(id);
      }, 0);
    } else {
      setProfile(null);
      setRole(null);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => appliquerSession(session));

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => appliquerSession(session));

    return () => subscription.unsubscribe();
  }, [appliquerSession]);

  const synchroniserSession = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    // Ne jamais effacer un utilisateur connu sur une simple relecture : la
    // déconnexion passe par l'événement SIGNED_OUT.
    if (data.session) appliquerSession(data.session);
    return data.session;
  }, [appliquerSession]);

  const signUp = async (email: string, password: string, metadata: SignUpMetadata) => {
    // Le lien du courriel revient sur la page « Adresse confirmée ».
    const redirectUrl = urlRetourAuth(PAGE_CONFIRMATION);
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: metadata,
      },
    });
    // « Confirm email » activé (SMTP branché) : pas de session tant que le
    // lien reçu par courriel n'a pas été cliqué.
    return { error, confirmationRequise: !error && !data.session };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRole(null);
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return { error: new Error('Not authenticated') };
    
    const { error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id);
    
    if (!error) {
      setProfile(prev => prev ? { ...prev, ...updates } : null);
    }
    
    return { error };
  };

  return (
    <AuthContext.Provider value={{
      user,
      session,
      profile,
      role,
      isLoading,
      signUp,
      signIn,
      signOut,
      synchroniserSession,
      updateProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
