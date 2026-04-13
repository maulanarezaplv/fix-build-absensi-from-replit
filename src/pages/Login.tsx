import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { User, Lock, Eye, EyeOff, ArrowLeft, GraduationCap, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { convertGDriveLink } from "@/lib/gdrive";
import { getWebConfig } from "@/lib/queryClient";

const Login = () => {
  const [logoError, setLogoError] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: webConfig } = useQuery({
    queryKey: ["public-web-config"],
    queryFn: getWebConfig,
    staleTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const logoUrl = webConfig?.logo_url ? convertGDriveLink(webConfig.logo_url) : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(username.trim(), password);
    if (error) {
      const isRateLimit = error.includes("429") || error.toLowerCase().includes("terlalu banyak");
      toast({
        title: "Login Gagal",
        description: isRateLimit
          ? "Terlalu banyak percobaan login. Coba lagi dalam 15 menit."
          : "Username atau password salah.",
        variant: "destructive",
      });
    } else {
      navigate("/admin");
    }
    setLoading(false);
  };

  const appTitle    = webConfig?.app_title    || "E-ABSENSI";
  const appSubtitle = webConfig?.app_subtitle || "Sistem Absensi Sekolah";

  return (
    <div className="animate-fade-in">
      {/* ── Card ── */}
      <div className="rounded-2xl overflow-hidden bg-white border border-slate-200/80 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.22)]" style={{ transform: "translateZ(0)" }}>

        {/* Header */}
        <div className="flex flex-col items-center pt-6 pb-5 px-6 text-center">
          {/* Logo */}
          <div className="mb-3">
            {logoUrl && !logoError
              ? <img
                  src={logoUrl}
                  alt="Logo"
                  className="w-20 h-20 object-contain"
                  onError={() => setLogoError(true)}
                />
              : <div className="w-20 h-20 flex items-center justify-center"><GraduationCap className="h-12 w-12 text-violet-600" /></div>}
          </div>

          <h1
            className="text-[22px] font-black tracking-widest text-slate-800 leading-tight"
            style={{ fontFamily: "'Cinzel Decorative', serif" }}
          >
            {appTitle}
          </h1>
          <p className="text-slate-600 text-[12px] mt-0.5 tracking-wide">{appSubtitle}</p>

          {/* Login badge */}
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-50 border border-violet-200 text-violet-600 text-[11px] font-semibold tracking-wide">
            <ShieldCheck className="h-3 w-3" />
            Login Admin / Guru
          </div>
        </div>

        {/* Divider */}
        <div className="mx-6 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

        {/* Form */}
        <div className="px-6 py-5">
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* Username */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-slate-600 tracking-widest uppercase">Username</p>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  type="text"
                  placeholder="Masukkan username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="pl-10 h-11 rounded-xl border-slate-200 bg-slate-50 text-sm text-slate-700 shadow-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400"
                  required
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold text-slate-600 tracking-widest uppercase">Password</p>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Masukkan password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-11 h-11 rounded-xl border-slate-200 bg-slate-50 text-sm text-slate-700 shadow-none focus:ring-2 focus:ring-violet-400/40 focus:border-violet-400"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl text-sm font-bold tracking-wide bg-gradient-to-r from-violet-600 via-blue-500 to-teal-500 hover:from-violet-700 hover:to-teal-600 text-white shadow-lg shadow-violet-500/30 active:scale-[0.98] transition-all border-0 mt-1"
            >
              {loading ? "Masuk..." : "Masuk"}
            </Button>
          </form>

          {/* Back link */}
          <div className="text-center mt-4 pb-1">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-violet-600 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Kembali ke halaman absensi
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
