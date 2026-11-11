import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./features/auth/LoginPage";
import RegisterPage from "./features/auth/RegisterPage";
import LostReportPage from "./features/lost-report/LostReportPage";
import FoundReportPage from "./features/found-report/FoundReportPage";
import CariBarangPage from "./features/search/CariBarangPage";
import LaporanSayaPage from "./features/my-reports/LaporanSayaPage";
import AjukanKlaimPage from "./features/claim/AjukanKlaimPage";
import KlaimSayaPage from "./features/claim/KlaimSayaPage";
import JadwalPage from "./features/handover/JadwalPage";
import NotifikasiPage from "./features/notification/NotifikasiPage";
import AkunPage from "./features/account/AkunPage";
import RequireAuth from "./shared/components/RequireAuth";
import AdminRingkasanPage from "./features/admin/AdminRingkasanPage";
import AdminTemuanPage from "./features/admin/AdminTemuanPage";
import AdminKlaimPage from "./features/admin/AdminKlaimPage";
import AdminJadwalPage from "./features/admin/AdminJadwalPage";
import AdminRiwayatPage from "./features/admin/AdminRiwayatPage";
import AdminPengelolaanPage from "./features/admin/AdminPengelolaanPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        {/* Halaman aplikasi: hanya untuk pengguna yang sudah masuk. */}
        <Route element={<RequireAuth />}>
          <Route path="/cari" element={<CariBarangPage />} />
          <Route path="/laporan-saya" element={<LaporanSayaPage />} />
          <Route path="/klaim-saya" element={<KlaimSayaPage />} />
          <Route path="/klaim/baru/:reportId" element={<AjukanKlaimPage />} />
          <Route path="/jadwal" element={<JadwalPage />} />
          <Route path="/notifikasi" element={<NotifikasiPage />} />
          <Route path="/akun" element={<AkunPage />} />
          <Route path="/lapor/kehilangan" element={<LostReportPage />} />
          <Route
            path="/lapor/kehilangan/:id/ubah"
            element={<LostReportPage />}
          />
          <Route path="/lapor/temuan" element={<FoundReportPage />} />
          <Route path="/lapor/temuan/:id/ubah" element={<FoundReportPage />} />
          <Route path="/beranda" element={<Navigate to="/cari" replace />} />
          <Route path="/admin" element={<AdminRingkasanPage />} />
          <Route path="/admin/temuan" element={<AdminTemuanPage />} />
          <Route path="/admin/klaim" element={<AdminKlaimPage />} />
          <Route path="/admin/jadwal" element={<AdminJadwalPage />} />
          <Route path="/admin/riwayat" element={<AdminRiwayatPage />} />
          <Route path="/admin/pengelolaan" element={<AdminPengelolaanPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
