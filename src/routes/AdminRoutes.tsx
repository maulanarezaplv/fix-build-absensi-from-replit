import { Routes, Route } from "react-router-dom";
import AdminLayout from "@/layouts/AdminLayout";
import Dashboard from "@/pages/Dashboard";
import Classes from "@/pages/Classes";
import Students from "@/pages/Students";
import History from "@/pages/History";
import Validation from "@/pages/Validation";
import AttendanceSettings from "@/pages/AttendanceSettings";
import GuruPiket from "@/pages/GuruPiket";
import Reports from "@/pages/Reports";
import UserManagement from "@/pages/UserManagement";
import WebConfig from "@/pages/WebConfig";
import RekapBulanan from "@/pages/RekapBulanan";
import WhatsAppReport from "@/pages/WhatsAppReport";
import DataReset from "@/pages/DataReset";
import Tutorial from "@/pages/Tutorial";
import RequireAdmin from "@/components/RequireAdmin";

const AdminRoutes = () => (
  <Routes>
    <Route element={<AdminLayout />}>
      <Route index element={<Dashboard />} />
      <Route path="validation" element={<Validation />} />
      <Route path="reports" element={<Reports />} />
      <Route path="rekap" element={<RekapBulanan />} />
      <Route path="history" element={<History />} />

      <Route element={<RequireAdmin />}>
        <Route path="classes" element={<Classes />} />
        <Route path="students" element={<Students />} />
        <Route path="settings" element={<AttendanceSettings />} />
        <Route path="guru-piket" element={<GuruPiket />} />
        <Route path="users" element={<UserManagement />} />
        <Route path="config" element={<WebConfig />} />
        <Route path="whatsapp-report" element={<WhatsAppReport />} />
        <Route path="reset" element={<DataReset />} />
        <Route path="tutorial" element={<Tutorial />} />
      </Route>
    </Route>
  </Routes>
);

export default AdminRoutes;
