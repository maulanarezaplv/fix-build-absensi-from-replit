import { Outlet, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import AdminSidebar, { useSidebarCollapse } from "@/components/AdminSidebar";
import AdminHeader from "@/components/AdminHeader";
import BottomNav from "@/components/BottomNav";

const AdminLayout = () => {
  const { user, isLoading } = useAuth();
  const { collapsed, toggle } = useSidebarCollapse();

  if (isLoading) {
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

        {/* Konten utama — pb-16 agar tidak tertutup BottomNav di HP */}
        <main className="flex-1 overflow-y-auto bg-background pb-16 md:pb-0">
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
