import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import LoginPage from "./features/auth/LoginPage";
import RegisterPage from "./features/auth/RegisterPage";
import LostReportPage from "./features/lost-report/LostReportPage";
import FoundReportPage from "./features/found-report/FoundReportPage";
import ComingSoon from "./shared/components/ComingSoon";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/lapor/kehilangan" element={<LostReportPage />} />
        <Route path="/lapor/temuan" element={<FoundReportPage />} />
        {/* Placeholder menu navbar. Ganti element-nya saat halaman asli jadi. */}
        <Route path="/cari" element={<ComingSoon title="Cari Barang" />} />
        <Route path="/laporan-saya" element={<ComingSoon title="Laporan Saya" />} />
        <Route path="/klaim-saya" element={<ComingSoon title="Klaim Saya" />} />
        <Route path="/jadwal" element={<ComingSoon title="Jadwal" />} />
        <Route path="/notifikasi" element={<ComingSoon title="Notifikasi" />} />
        <Route path="/akun" element={<ComingSoon title="Akun" />} />
      </Routes>
    </BrowserRouter>
  );
}