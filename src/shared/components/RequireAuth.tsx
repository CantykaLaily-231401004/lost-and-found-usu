import { Navigate, Outlet } from "react-router-dom";
import { useSessionUser } from "../hooks/useSessionUser";

/** Halaman di dalamnya hanya untuk pengguna yang sudah masuk. */
export default function RequireAuth() {
  const { user, ready } = useSessionUser();
  if (!ready) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}
