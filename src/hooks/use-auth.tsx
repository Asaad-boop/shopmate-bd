import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEYS = [
  "sb-ywutobfdoqktfkakbcch-auth-token",
  "supabase.auth.token",
];

function clearStoredAuthState() {
  try {
    AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));

    Object.keys(localStorage)
      .filter((key) => key.startsWith("sb-") && key.includes("-auth-token"))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignore storage errors
  }
}

function toAuthError(error: unknown, fallback: string) {
  if (error instanceof Error) return error;
  return new Error(fallback);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    void supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
      })
      .catch(() => {
        clearStoredAuthState();
        setSession(null);
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (!error) return { error: null };

      return { error: new Error(error.message) };
    } catch (error) {
      clearStoredAuthState();

      try {
        const { error: retryError } = await supabase.auth.signInWithPassword({ email, password });
        return { error: retryError ? new Error(retryError.message) : null };
      } catch (retryError) {
        return {
          error: toAuthError(retryError, "Unable to sign in right now. Please try again."),
        };
      }
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });

      return { error: error ? new Error(error.message) : null };
    } catch (error) {
      return {
        error: toAuthError(error, "Unable to create account right now. Please try again."),
      };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      clearStoredAuthState();
      setSession(null);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
