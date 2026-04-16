import { useState, useEffect } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AdminSidebar, { useSidebarCollapse } from "@/components/AdminSidebar";
import AdminHeader from "@/components/AdminHeader";
import BottomNav from "@/components/BottomNav";
import TopLoadingBar from "@/components/TopLoadingBar";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Download, X, Smartphone, AlertTriangle, ChevronDown, ChevronUp, Copy, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const PWAInstallBanner = () => {
  const { canInstall, install } = usePWAInstall();
  const [dismissed, setDismissed] = useState(false);

  if (!canInstall || dismissed) return null;

  return (
    <div className="md:hidden flex items-center gap-3 px-3 py-2.5 bg-gradient-to-r from-[hsl(260,70%,55%)] to-[hsl(199,89%,48%)] text-white text-xs">
      <Smartphone className="h-4 w-4 flex-shrink-0" />
      <span className="flex-1 font-medium leading-snug">
        Install E-Absensi ke layar utama HP untuk akses lebih cepat &amp; tanpa gangguan browser
      </span>
      <button
        onClick={install}
        className="flex-shrink-0 flex items-center gap-1 bg-white/20 hover:bg-white/30 rounded-lg px-2.5 py-1 font-bold transition-colors"
        data-testid="button-pwa-install"
      >
        <Download className="h-3.5 w-3.5" />
        Install
      </button>
      <button
        onClick={() => setDismissed(true)}
        className="flex-shrink-0 p-0.5 hover:bg-white/20 rounded transition-colors"
        aria-label="Tutup"
        data-testid="button-pwa-dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

const SUPABASE_WARNING_KEY = "ea_supabase_warn_dismissed_v1";

const MIGRATION_SQL = `-- Jalankan SQL ini di Supabase Dashboard > SQL Editor
-- Ini akan memperbaiki izin penulisan data untuk pengguna yang login

-- Tambah kebijakan akses untuk kelas
DROP POLICY IF EXISTS "Guru can manage classes" ON public.classes;
CREATE POLICY "Guru can manage classes" ON public.classes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tambah kebijakan akses untuk siswa
DROP POLICY IF EXISTS "Guru can manage students" ON public.students;
CREATE POLICY "Guru can manage students" ON public.students
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tambah kebijakan hapus catatan absensi
DROP POLICY IF EXISTS "Guru can delete attendance" ON public.attendance_records;
CREATE POLICY "Guru can delete attendance" ON public.attendance_records
  FOR DELETE TO authenticated USING (true);

-- Tambah kebijakan pengaturan absensi
DROP POLICY IF EXISTS "Guru can manage settings" ON public.attendance_settings;
CREATE POLICY "Guru can manage settings" ON public.attendance_settings
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tambah kebijakan hari libur
DROP POLICY IF EXISTS "Guru can manage holidays" ON public.holidays;
CREATE POLICY "Guru can manage holidays" ON public.holidays
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tambah kebijakan piket
DROP POLICY IF EXISTS "Guru can manage piket" ON public.guru_piket_assignments;
CREATE POLICY "Guru can manage piket" ON public.guru_piket_assignments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Tambah kebijakan user_roles
DROP POLICY IF EXISTS "Guru can insert roles" ON public.user_roles;
CREATE POLICY "Guru can insert roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (true);

-- Aktifkan role admin untuk pengguna pertama jika belum ada
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    SELECT user_id FROM public.profiles LIMIT 1
    ON CONFLICT DO NOTHING;
  END IF;
END; $$;`;

const SupabaseSessionBanner = () => {
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem(SUPABASE_WARNING_KEY));
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setHasSession(!!data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setHasSession(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (hasSession === null || hasSession || dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(SUPABASE_WARNING_KEY, "1");
    setDismissed(true);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(MIGRATION_SQL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="border-b border-amber-300 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700 text-amber-900 dark:text-amber-200">
      <div className="flex items-start gap-2.5 px-4 py-2.5">
        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold">
            Sesi Supabase tidak aktif — operasi simpan/hapus mungkin gagal
          </p>
          <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
            Login admin menggunakan bypass lokal. Untuk mengaktifkan penulisan ke Supabase, Anda perlu:
            <strong className="font-bold"> (1)</strong> membuat akun auth di Supabase Dashboard dengan email <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">admin@eabsensi.internal</code> dan password <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">admin123</code>, lalu
            <strong className="font-bold"> (2)</strong> menjalankan SQL di bawah ini.
          </p>
          <button
            onClick={() => setExpanded(e => !e)}
            className="mt-1.5 flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 transition-colors"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded ? "Sembunyikan SQL" : "Tampilkan SQL untuk dijalankan di Supabase"}
          </button>
          {expanded && (
            <div className="relative mt-2">
              <pre className="text-[10px] bg-amber-100 dark:bg-amber-900/60 rounded-lg p-3 overflow-x-auto max-h-40 leading-relaxed text-amber-900 dark:text-amber-200 whitespace-pre-wrap">
                {MIGRATION_SQL}
              </pre>
              <button
                onClick={handleCopy}
                className="absolute top-2 right-2 flex items-center gap-1 text-[10px] bg-amber-200 dark:bg-amber-800 hover:bg-amber-300 dark:hover:bg-amber-700 px-2 py-1 rounded-md transition-colors font-medium"
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? "Tersalin!" : "Salin"}
              </button>
            </div>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 p-0.5 hover:bg-amber-200 dark:hover:bg-amber-800 rounded transition-colors"
          aria-label="Tutup"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

const AdminLayout = () => {
  const { user, isLoading } = useAuth();
  const { collapsed, toggle } = useSidebarCollapse();

  if (isLoading && !user) {
    return (
      <div className="flex items-center justify-center bg-background" style={{ height: "100dvh" }}>
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex overflow-hidden" style={{ height: "100dvh" }}>
      {/* Indikator loading navigasi antar halaman */}
      <TopLoadingBar />

      {/* Desktop sidebar — hanya tampil di layar lebar */}
      <AdminSidebar
        collapsed={collapsed}
        onMobileClose={() => {}}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <AdminHeader
          collapsed={collapsed}
          onToggleSidebar={toggle}
        />

        {/* Banner peringatan Supabase session — jika admin login tanpa sesi JWT */}
        <SupabaseSessionBanner />

        {/* Banner install PWA — hanya muncul di HP jika belum install */}
        <PWAInstallBanner />

        {/* Konten utama — pb agar tidak tertutup BottomNav + safe area di HP */}
        <main className="flex-1 overflow-y-auto bg-background admin-main-content">
          <div className="p-3 md:p-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Bottom navigation — hanya HP */}
      <BottomNav />
    </div>
  );
};

export default AdminLayout;
