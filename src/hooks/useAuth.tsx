import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { apiRequest } from "@/lib/queryClient";

type AppRole = "admin" | "guru";

type AuthUser = {
  id: string;
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

export function AuthProvider({ children }: { children: ReactNode }) {
  // Langsung baca cache dari localStorage — buka tab baru = instan, tidak perlu tunggu server
  const [user, setUser] = useState<AuthUser | null>(readCache);
  // Jika ada cache, anggap sudah loaded (tidak perlu tampil spinner)
  const [isLoading, setIsLoading] = useState(() => !readCache());

  useEffect(() => {
    // Verifikasi ke server di background — update jika ada perbedaan, tidak blokir UI
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        const fresh = (data && data.id) ? (data as AuthUser) : null;
        setUser(fresh);
        writeCache(fresh);
      })
      .catch(() => {
        // Jika network error, tetap pakai cache (user masih terlihat logged in)
      })
      .finally(() => setIsLoading(false));
  }, []);

  const signIn = async (username: string, password: string) => {
    try {
      const data = await apiRequest("POST", "/api/auth/login", { username, password });
      const authUser = data as AuthUser;
      setUser(authUser);
      writeCache(authUser);
      return { error: null };
    } catch (e: any) {
      return { error: e.message || "Login gagal" };
    }
  };

  const signOut = async () => {
    try { await apiRequest("POST", "/api/auth/logout"); } catch {}
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
