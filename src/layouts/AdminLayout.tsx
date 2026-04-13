import { useState } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AdminSidebar, { useSidebarCollapse } from "@/components/AdminSidebar";
import AdminHeader from "@/components/AdminHeader";
import BottomNav from "@/components/BottomNav";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Download, X, Smartphone } from "lucide-react";

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

const AdminLayout = () => {
  const { user, isLoading } = useAuth();
  const { collapsed, toggle } = useSidebarCollapse();

  if (isLoading && !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
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
