import React, {
    createContext,
    useState,
    useContext,
    useEffect,
    ReactNode,
  } from 'react';
  import { Session, User } from '@supabase/supabase-js';
  import { supabase } from '~/utils/supabase';
import { ActivityIndicator } from 'react-native';
  
  type AuthContextType = {
    session: Session | null;
    user: User | null;
    isAuthenticated: boolean;
  };
  
  const AuthContext = createContext<AuthContextType>({
    session: null,
    user: null,
    isAuthenticated: false,
  });
  
  export default function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [isReady, setIsReady] = useState<boolean>(false)
  
    useEffect(() => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        setSession(session);
        setIsReady(true);

      });
  
      const { data: authListener } = supabase.auth.onAuthStateChange(
        (_event, session) => {
          setSession(session);
        }
      );
  
      return () => {
        authListener.subscription.unsubscribe();
      };
    }, []);
    if (!isReady) {
       return <ActivityIndicator />
        
    }
  
    return (
      <AuthContext.Provider
        value={{
          session,
          user: session?.user ?? null,
          isAuthenticated: !!session?.user,
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  }
  
  export const useAuth = () => useContext(AuthContext);
  