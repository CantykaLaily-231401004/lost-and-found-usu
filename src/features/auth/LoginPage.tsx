import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";
import AuthLayout from "../../shared/components/AuthLayout";
import TextField from "../../shared/components/TextField";
import Button from "../../shared/components/Button";
import { normalizeEmail } from "./emailDomain";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password)
      return setError("Surel dan kata sandi wajib diisi.");

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });
    setLoading(false);

    if (error) {
      return setError(
        error.message.toLowerCase().includes("not confirmed")
          ? "Surel belum diverifikasi. Cek kotak masuk Anda."
          : "Surel atau kata sandi salah.",
      );
    }
    navigate("/");
  }

  return (
    <AuthLayout>
      <h2 className="font-display text-3xl font-bold tracking-tight text-gray-900">
        Masuk
      </h2>
      <p className="mt-2 text-sm leading-6 text-gray-600">
        Gunakan surel kampus Anda (@students.usu.ac.id atau @usu.ac.id).
      </p>

      <form onSubmit={handleSubmit} className="mt-8 space-y-5">
        <TextField
          label="Alamat surel"
          type="email"
          autoComplete="email"
          placeholder="nama@students.usu.ac.id"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label="Kata sandi"
          type="password"
          autoComplete="current-password"
          placeholder="Masukkan kata sandi"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <Button type="submit" loading={loading}>
          {loading ? "Memproses..." : "Masuk"}
        </Button>
      </form>

      <p className="mt-8 text-sm text-gray-600">
        Belum punya akun?{" "}
        <Link
          to="/register"
          className="font-medium text-brand-800 underline-offset-4 hover:underline"
        >
          Daftar
        </Link>
      </p>
    </AuthLayout>
  );
}
