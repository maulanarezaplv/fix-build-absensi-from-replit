import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const RequireAdmin = () => {
  const { isAdmin, isLoading } = useAuth();

  if (isLoading) return null;

  if (!isAdmin) {
    return <Navigate to="/admin" replace />;
  }

  return <Outlet />;
};

export default RequireAdmin;
