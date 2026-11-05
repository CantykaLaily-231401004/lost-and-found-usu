import { BrowserRouter, Routes, Route } from "react-router-dom";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={<div className="p-6 text-xl">Lost and Found USU</div>}
        />
        <Route path="/login" element={<div>Login</div>} />
        <Route path="/register" element={<div>Registrasi</div>} />
      </Routes>
    </BrowserRouter>
  );
}
