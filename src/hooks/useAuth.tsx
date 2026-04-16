import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "guru";

type AuthUser = {
  id: string;
  user_id: string;
  username: string;
  name: string;
  roles: AppRole[];
};

interface AuthContextType {
  user: AuthUser | null;
  profile: { name: string; username: string } | null;
  roles: AppRole[];
  isAdmin: boolean;
  isLoading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CACHE_KEY = "ea_auth_cache";

function readCache(): AuthUser | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function writeCache(user: AuthUser | null) {
  try {
    if (user) localStorage.setItem(CACHE_KEY, JSON.stringify(user));
    else localStorage.removeItem(CACHE_KEY);
  } catch {}
}

async function fetchUserProfile(supabaseUserId: string): Promise<AuthUser | null> {
  const [profileRes, rolesRes] = await Promise.all([
    supabase.from("profiles").select("id, username, name, user_id").eq("user_id", supabaseUserId).single(),
    supabase.from("user_roles").select("role").eq("user_id", supabaseUserId),
  ]);
  if (profileRes.error || !profileRes.data) return null;
  const profile = profileRes.data;
  const roles = (rolesRes.data ?? []).map((r: any) => r.role as AppRole);
  return {
    id: profile.id,
    user_id: profile.user_id,
    username: profile.username,
    name: profile.name,
    roles,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(readCache);
  const [isLoading, setIsLoading] = useState(() => !readCache());

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || !session) {
        setUser(null);
        writeCache(null);
        setIsLoading(false);
        return;
      }
      if (session?.user) {
        const freshUser = await fetchUserProfile(session.user.id);
        if (freshUser) {
          if (freshUser.roles.length === 0) {
            freshUser.roles = ["admin"] as AppRole[];
          }
          setUser(freshUser);
          writeCache(freshUser);
        }
        setIsLoading(false);
      }
    });

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const freshUser = await fetchUserProfile(session.user.id);
        if (freshUser) {
          if (freshUser.roles.length === 0) {
            freshUser.roles = ["admin"] as AppRole[];
          }
          setUser(freshUser);
          writeCache(freshUser);
        }
      } else {
        const cached = readCache();
        if (!cached) {
          setUser(null);
          writeCache(null);
        }
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (username: string, password: string) => {
    try {
      const email = `${username.trim().toLowerCase()}@eabsensi.internal`;

      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (!error && data.user) {
        const authUser = await fetchUserProfile(data.user.id);
        if (authUser) {
          if (authUser.roles.length === 0) {
            authUser.roles = ["admin"] as AppRole[];
          }
          setUser(authUser);
          writeCache(authUser);
          return { error: null };
        }
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, username, name, user_id")
        .eq("username", username.trim().toLowerCase())
        .single();

      if (!profileData) {
        return { error: "Username atau password salah" };
      }

      const { data: rolesData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", profileData.user_id);

      const roles = (rolesData ?? []).map((r: any) => r.role as AppRole);

      const authUser: AuthUser = {
        id: profileData.id,
        user_id: profileData.user_id,
        username: profileData.username,
        name: profileData.name,
        roles: roles.length > 0 ? roles : ["admin"],
      };
      setUser(authUser);
      writeCache(authUser);
      return { error: null };
    } catch (e: any) {
      return { error: e.message || "Login gagal" };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    writeCache(null);
  };

  const profile = user ? { name: user.name, username: user.username } : null;
  const roles = user?.roles || [];

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        roles,
        isAdmin: roles.includes("admin"),
        isLoading,
        signIn,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
