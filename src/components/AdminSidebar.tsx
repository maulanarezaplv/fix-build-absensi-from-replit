import { memo, useState, useMemo, useCallback } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import {
  LayoutDashboard, Users, School, ClipboardCheck,
  Calendar, LogOut, GraduationCap, UserCog, Globe,
  FileText, CalendarDays, MessageCircle, X, DatabaseZap,
  Clock, UserCheck, QrCode, BookOpen
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { convertGDriveLink } from "@/lib/gdrive";
import { getWebConfig } from "@/lib/queryClient";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const allMenuItems = [
  // ── Selalu di atas ──
  { to: "/admin",            icon: LayoutDashboard, label: "Dashboard" },

  // ── Harian — paling sering dipakai ──
  { to: "/admin/history",         icon: QrCode,         label: "Scan & Absensi" },
  { to: "/admin/validation",      icon: ClipboardCheck, label: "Validasi Absen" },
  { to: "/admin/reports",         icon: FileText,       label: "Laporan Harian" },
  { to: "/admin/rekap",           icon: CalendarDays,   label: "Rekap Bulanan" },

  // ── Pengelolaan — berkala ──
  { to: "/admin/settings",        icon: Clock,          label: "Kelola Absen",        adminOnly: true },
  { to: "/admin/guru-piket",      icon: UserCheck,      label: "Guru Piket",          adminOnly: true },
  { to: "/admin/classes",         icon: School,         label: "Manajemen Kelas",     adminOnly: true },
  { to: "/admin/students",        icon: Users,          label: "Data Siswa",          adminOnly: true },
  { to: "/admin/whatsapp-report", icon: MessageCircle,  label: "Kirim Laporan WA",    adminOnly: true },

  // ── Administrasi — jarang ──
  { to: "/admin/users",           icon: UserCog,        label: "Manajemen Pengguna",  adminOnly: true },
  { to: "/admin/config",          icon: Globe,          label: "Konfigurasi WebApps", adminOnly: true },
  { to: "/admin/reset",           icon: DatabaseZap,    label: "Kelola & Reset Data", adminOnly: true },
  { to: "/admin/tutorial",        icon: BookOpen,       label: "Tutorial & Panduan",  adminOnly: true },
];

export const useSidebarCollapse = () => {
  const [collapsed, setCollapsed] = useState(false);
  const toggle = useCallback(() => setCollapsed(c => !c), []);
  return { collapsed, toggle };
};

interface AdminSidebarProps {
  collapsed: boolean;
  onMobileClose: () => void;
}

const SidebarContent = memo(({
  collapsed,
  isMobile,
  onMobileClose,
}: {
  collapsed: boolean;
  isMobile: boolean;
  onMobileClose: () => void;
}) => {
  const { profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);

  const { data: webConfig } = useQuery({
    queryKey: ["public-web-config"],
    queryFn: getWebConfig,
    staleTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const appTitle = webConfig?.app_title || "E-ABSENSI";
  const appSubtitle = webConfig?.app_subtitle || "SCHOOL SYSTEM";
  const logoUrl = webConfig?.logo_url ? convertGDriveLink(webConfig.logo_url) : null;

  const handleLogout = useCallback(async () => {
    await signOut();
    navigate("/login");
  }, [signOut, navigate]);

  const filteredItems = useMemo(
    () => allMenuItems.filter(item => !("adminOnly" in item && item.adminOnly) || isAdmin),
    [isAdmin]
  );

  const showLabels = isMobile || !collapsed;
  const initial = profile?.name?.charAt(0)?.toUpperCase() || "U";

  return (
    <div
      className="relative flex h-full flex-col text-sidebar-foreground overflow-hidden"
      style={{ background: "linear-gradient(180deg, hsl(230 25% 14%) 0%, hsl(220 30% 8%) 100%)" }}
    >
      {/* Header */}
      <div className="relative flex items-center gap-3 px-3 py-3 border-b border-white/10">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="h-9 w-9 rounded-lg object-contain flex-shrink-0" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[hsl(260,70%,55%)] to-[hsl(199,89%,48%)] flex-shrink-0">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
        )}
        {showLabels && (
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold truncate">{appTitle}</h2>
            <p className="text-[10px] text-sidebar-foreground/50 truncate">{appSubtitle}</p>
          </div>
        )}
        {isMobile && (
          <button
            onClick={onMobileClose}
            className="ml-auto p-1.5 rounded-lg hover:bg-white/10 text-sidebar-foreground/70"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* User profile — solid bg, no blur */}
      {showLabels ? (
        <div className="relative mx-3 mt-3 rounded-xl bg-white/8 border border-white/10 p-3 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-[hsl(260,70%,55%)] to-[hsl(199,89%,48%)] text-white text-sm font-bold flex-shrink-0">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-sidebar-foreground truncate">{profile?.name || "User"}</p>
            <p className="text-xs text-sidebar-foreground/50 flex items-center gap-1.5">
              <span className="relative inline-flex h-1.5 w-1.5 flex-shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Online
            </p>
          </div>
          <span className="text-[10px] font-bold bg-destructive text-destructive-foreground px-2 py-0.5 rounded-full uppercase">
            {isAdmin ? "Admin" : "Guru"}
          </span>
        </div>
      ) : (
        <div className="flex justify-center mt-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-r from-[hsl(260,70%,55%)] to-[hsl(199,89%,48%)] text-white text-sm font-bold">
            {initial}
          </div>
        </div>
      )}

      {/* Nav items */}
      <nav className="relative flex-1 overflow-y-auto py-3 px-2 space-y-0.5 sidebar-scroll">
        {filteredItems.map(({ to, icon: Icon, label }) => {
          const link = (
            <NavLink
              key={to}
              to={to}
              end={to === "/admin"}
              onClick={isMobile ? onMobileClose : undefined}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-[background-color,color] duration-150",
                  !showLabels && "justify-center px-2",
                  isActive
                    ? "bg-gradient-to-r from-[hsl(260,70%,55%)] to-[hsl(199,89%,48%)] text-white"
                    : "text-sidebar-foreground/60 hover:bg-white/8 hover:text-sidebar-foreground"
                )
              }
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {showLabels && label}
            </NavLink>
          );

          if (!showLabels) {
            return (
              <Tooltip key={to}>
                <TooltipTrigger asChild>{link}</TooltipTrigger>
                <TooltipContent side="right">{label}</TooltipContent>
              </Tooltip>
            );
          }
          return link;
        })}
      </nav>

      {/* Logout */}
      <div className="relative border-t border-white/10 p-2">
        {!showLabels ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="w-full text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10"
                onClick={() => setShowLogout(true)}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Keluar</TooltipContent>
          </Tooltip>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10"
            onClick={() => setShowLogout(true)}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Keluar
          </Button>
        )}
      </div>

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
            <AlertDialogAction onClick={handleLogout} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Ya, Keluar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
SidebarContent.displayName = "SidebarContent";

const AdminSidebar = memo(({ collapsed, onMobileClose }: AdminSidebarProps) => (
  /* Desktop sidebar — hanya tampil di layar lebar */
  <aside className={cn(
    "hidden md:flex h-screen flex-col border-r border-sidebar-border flex-shrink-0 transition-[width] duration-200",
    collapsed ? "w-16" : "w-64"
  )}>
    <SidebarContent collapsed={collapsed} isMobile={false} onMobileClose={onMobileClose} />
  </aside>
));
AdminSidebar.displayName = "AdminSidebar";

export default AdminSidebar;
