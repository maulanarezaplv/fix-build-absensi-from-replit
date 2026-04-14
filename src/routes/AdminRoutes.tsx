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
  <div className="flex items-center justify-center h-40">
    <div className="h-7 w-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
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
