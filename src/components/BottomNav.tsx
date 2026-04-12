import { memo, useMemo, useState, useCallback } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { allMenuItems } from "@/components/AdminSidebar";
import { cn } from "@/lib/utils";
import { LogOut } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const shortLabel: Record<string, string> = {
  "Dashboard":           "Dashboard",
  "Manajemen Kelas":     "Kelas",
  "Data Siswa":          "Siswa",
  "Validasi Absen":      "Validasi",
  "Manajemen Pengguna":  "Pengguna",
  "Laporan Harian":      "Laporan",
  "Rekap Bulanan":       "Rekap",
  "Kelola Absen":        "Absen",
  "Guru Piket":          "Piket",
  "Scan & Absensi":      "Scan",
  "Konfigurasi WebApps": "Konfigurasi",
  "Kirim Laporan WA":    "WhatsApp",
  "Kelola & Reset Data": "Reset",
  "Tutorial & Panduan":  "Tutorial",
};

const BottomNav = memo(() => {
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);

  const items = useMemo(
    () => allMenuItems.filter(item => !("adminOnly" in item && item.adminOnly) || isAdmin),
    [isAdmin]
  );

  const handleLogout = useCallback(async () => {
    await signOut();
    navigate("/login");
  }, [signOut, navigate]);

  const initial = profile?.name?.charAt(0)?.toUpperCase() || "U";
  const shortName = profile?.name
    ? profile.name.split(" ").slice(0, 2).join(" ")
    : "User";

  const navBg: React.CSSProperties = {
    background: "linear-gradient(180deg, hsl(230 25% 14%) 0%, hsl(220 30% 8%) 100%)",
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-30 md:hidden border-t border-white/10 flex items-stretch"
        style={navBg}
      >
        {/* ── Identitas user — fixed kiri ── */}
        <div
          className="flex-shrink-0 flex flex-col items-center justify-center gap-0.5 px-3 h-16 border-r border-white/10"
          style={{ minWidth: 64 }}
        >
          {/* Avatar */}
          <div className="relative">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(260,70%,55%)] to-[hsl(199,89%,48%)] text-white text-sm font-bold leading-none select-none">
              {initial}
            </div>
            {/* Dot online */}
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 border-2 border-[hsl(220,30%,8%)]" />
          </div>
          {/* Nama singkat */}
          <span className="text-[9px] leading-none font-semibold text-white/80 max-w-[56px] truncate text-center">
            {shortName}
          </span>
          {/* Role badge */}
          <span className={cn(
            "text-[8px] font-bold px-1.5 py-0.5 rounded-full uppercase leading-none",
            isAdmin
              ? "bg-destructive text-white"
              : "bg-blue-600 text-white"
          )}>
            {isAdmin ? "Admin" : "Guru"}
          </span>
        </div>

        {/* ── Menu items — scrollable tengah ── */}
        <div className="flex-1 overflow-x-auto scrollbar-none">
          <div className="flex items-stretch h-16 px-1 min-w-max">
            {items.map(({ to, icon: Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/admin"}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center gap-0.5 px-3 min-w-[60px] text-center transition-colors duration-150",
                    isActive ? "text-white" : "text-white/45 hover:text-white/75"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={cn(
                        "flex items-center justify-center w-9 h-7 rounded-xl transition-colors duration-150",
                        isActive
                          ? "bg-gradient-to-r from-[hsl(260,70%,55%)] to-[hsl(199,89%,48%)]"
                          : "bg-transparent"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="text-[10px] leading-none font-medium">
                      {shortLabel[label] ?? label}
                    </span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>

        {/* ── Tombol Keluar — fixed kanan ── */}
        <button
          onClick={() => setShowLogout(true)}
          className="flex-shrink-0 flex flex-col items-center justify-center gap-0.5 px-3 h-16 border-l border-white/10 text-red-400 hover:text-red-300 hover:bg-red-950/30 transition-colors duration-150"
          style={{ minWidth: 56 }}
          title="Keluar"
        >
          <LogOut className="h-5 w-5" />
          <span className="text-[10px] leading-none font-medium">Keluar</span>
        </button>
      </nav>

      {/* Dialog konfirmasi logout */}
      <AlertDialog open={showLogout} onOpenChange={setShowLogout}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Konfirmasi Keluar</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin keluar dari aplikasi?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleLogout}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Ya, Keluar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
BottomNav.displayName = "BottomNav";

export default BottomNav;
