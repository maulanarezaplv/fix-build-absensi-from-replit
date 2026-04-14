import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import AdminLayout from "@/layouts/AdminLayout";
import RequireAdmin from "@/components/RequireAdmin";

const Dashboard         = lazy(() => import("@/pages/Dashboard"));
const Classes           = lazy(() => import("@/pages/Classes"));
const Students          = lazy(() => import("@/pages/Students"));
const History           = lazy(() => import("@/pages/History"));
const Validation        = lazy(() => import("@/pages/Validation"));
const AttendanceSettings= lazy(() => import("@/pages/AttendanceSettings"));
const GuruPiket         = lazy(() => import("@/pages/GuruPiket"));
const Reports           = lazy(() => import("@/pages/Reports"));
const UserManagement    = lazy(() => import("@/pages/UserManagement"));
const WebConfig         = lazy(() => import("@/pages/WebConfig"));
const RekapBulanan      = lazy(() => import("@/pages/RekapBulanan"));
const WhatsAppReport    = lazy(() => import("@/pages/WhatsAppReport"));
const DataReset         = lazy(() => import("@/pages/DataReset"));
const Tutorial          = lazy(() => import("@/pages/Tutorial"));

const PageLoader = () => (
  <div className="p-3 md:p-6 space-y-4 animate-pulse">
    <div className="h-8 w-48 rounded-lg bg-muted" />
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="h-24 rounded-xl bg-muted" />
      ))}
    </div>
    <div className="h-64 rounded-xl bg-muted" />
    <div className="h-48 rounded-xl bg-muted" />
  </div>
);

const AdminRoutes = () => (
  <Routes>
    <Route element={<AdminLayout />}>
      <Route index element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
      <Route path="validation" element={<Suspense fallback={<PageLoader />}><Validation /></Suspense>} />
      <Route path="reports" element={<Suspense fallback={<PageLoader />}><Reports /></Suspense>} />
      <Route path="rekap" element={<Suspense fallback={<PageLoader />}><RekapBulanan /></Suspense>} />
      <Route path="history" element={<Suspense fallback={<PageLoader />}><History /></Suspense>} />

      <Route element={<RequireAdmin />}>
        <Route path="classes" element={<Suspense fallback={<PageLoader />}><Classes /></Suspense>} />
        <Route path="students" element={<Suspense fallback={<PageLoader />}><Students /></Suspense>} />
        <Route path="settings" element={<Suspense fallback={<PageLoader />}><AttendanceSettings /></Suspense>} />
        <Route path="guru-piket" element={<Suspense fallback={<PageLoader />}><GuruPiket /></Suspense>} />
        <Route path="users" element={<Suspense fallback={<PageLoader />}><UserManagement /></Suspense>} />
        <Route path="config" element={<Suspense fallback={<PageLoader />}><WebConfig /></Suspense>} />
        <Route path="whatsapp-report" element={<Suspense fallback={<PageLoader />}><WhatsAppReport /></Suspense>} />
        <Route path="reset" element={<Suspense fallback={<PageLoader />}><DataReset /></Suspense>} />
        <Route path="tutorial" element={<Suspense fallback={<PageLoader />}><Tutorial /></Suspense>} />
      </Route>
    </Route>
  </Routes>
);

export default AdminRoutes;
