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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then(r => r.json())
      .then(data => {
        if (data && data.id) setUser(data as AuthUser);
        else setUser(null);
      })
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const signIn = async (username: string, password: string) => {
    try {
      const data = await apiRequest("POST", "/api/auth/login", { username, password });
      setUser(data as AuthUser);
      return { error: null };
    } catch (e: any) {
      return { error: e.message || "Login gagal" };
    }
  };

  const signOut = async () => {
    try { await apiRequest("POST", "/api/auth/logout"); } catch {}
    setUser(null);
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
