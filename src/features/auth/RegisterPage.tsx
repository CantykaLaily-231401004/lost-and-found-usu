import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { isCampusEmail, normalizeEmail } from "./emailDomain";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  function startCooldown() {
    setCooldown(60);
    const t = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(t);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const cleanEmail = normalizeEmail(email);

    if (!name.trim()) return setError("Nama wajib diisi.");
    if (!isCampusEmail(cleanEmail))
      return setError(
        "Gunakan surel kampus (@students.usu.ac.id atau @usu.ac.id).",
      );
    if (password.length < 8) return setError("Kata sandi minimal 8 karakter.");

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { name: name.trim() },
        emailRedirectTo: window.location.origin + "/login",
      },
    });
    setLoading(false);

    if (error) return setError("Pendaftaran gagal: " + error.message);
    setSent(true);
    startCooldown();
  }

  async function handleResend() {
    setError("");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: normalizeEmail(email),
    });
    if (error) return setError("Gagal mengirim ulang: " + error.message);
    startCooldown();
  }

  if (sent) {
    return (
      <div className="mx-auto max-w-md p-6">
        <h1 className="mb-2 text-2xl font-semibold">Cek surel kamu</h1>
        <p className="mb-4 text-gray-600">
          Tautan verifikasi dikirim ke {normalizeEmail(email)}. Berlaku 24 jam.
        </p>
        {error && <p className="mb-3 text-sm text-red-600">{error}</p>}
        <button
          onClick={handleResend}
          disabled={cooldown > 0}
          className="rounded bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
        >
          {cooldown > 0 ? `Kirim ulang (${cooldown}s)` : "Kirim ulang tautan"}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="mb-4 text-2xl font-semibold">Registrasi</h1>
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          className="w-full rounded border p-2"
          placeholder="Nama lengkap"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="w-full rounded border p-2"
          type="email"
          placeholder="Surel kampus"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="w-full rounded border p-2"
          type="password"
          placeholder="Kata sandi"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          disabled={loading}
          className="w-full rounded bg-blue-600 p-2 text-white disabled:opacity-50"
        >
          {loading ? "Memproses..." : "Daftar"}
        </button>
      </form>
      <p className="mt-4 text-sm">
        Sudah punya akun?{" "}
        <Link to="/login" className="text-blue-600">
          Masuk
        </Link>
      </p>
    </div>
  );
}
