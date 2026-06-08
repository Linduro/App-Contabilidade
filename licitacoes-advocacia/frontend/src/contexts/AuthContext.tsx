import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Advogado } from "@/types";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  advogado: Advogado | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (nome: string, email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshAdvogado: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchAdvogado(user: User): Promise<Advogado | null> {
  const { data, error } = await supabase
    .from("advogados")
    .select("id, nome, email, auth_user_id, ativo")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (data) return data;

  const { data: byEmail, error: emailError } = await supabase
    .from("advogados")
    .select("id, nome, email, auth_user_id, ativo")
    .eq("email", user.email ?? "")
    .maybeSingle();

  if (emailError) throw emailError;
  if (!byEmail) return null;

  if (!byEmail.auth_user_id) {
    const { data: linked, error: linkError } = await supabase
      .from("advogados")
      .update({ auth_user_id: user.id })
      .eq("id", byEmail.id)
      .select("id, nome, email, auth_user_id, ativo")
      .single();

    if (linkError) throw linkError;
    return linked;
  }

  return byEmail;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [advogado, setAdvogado] = useState<Advogado | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAdvogado = async (user: User | null) => {
    if (!user) {
      setAdvogado(null);
      return;
    }

    const profile = await fetchAdvogado(user);
    setAdvogado(profile);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadAdvogado(data.session?.user ?? null).finally(() => setLoading(false));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      loadAdvogado(nextSession?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (nome: string, email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;

    const user = data.user;
    if (!user) throw new Error("Não foi possível criar a conta.");

    const { error: profileError } = await supabase.from("advogados").insert({
      nome,
      email,
      auth_user_id: user.id,
      ativo: true,
    });

    if (profileError) throw profileError;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setAdvogado(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      advogado,
      loading,
      signIn,
      signUp,
      signOut,
      refreshAdvogado: async () => {
        if (session?.user) await loadAdvogado(session.user);
      },
    }),
    [session, advogado, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider.");
  }
  return context;
}
