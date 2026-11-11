import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";
import AuthLayout from "../../shared/components/AuthLayout";
import TextField from "../../shared/components/TextField";
import Button from "../../shared/components/Button";
import { isCampusEmail, normalizeEmail } from "./emailDomain";

type Errors = { name?: string; email?: string; password?: string };

export default function RegisterPage() {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const resendLock = useRef(false);

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

  useEffect(() => {
    if (!pendingUserId) return;
    const channel = supabase
      .channel(`signup:${pendingUserId}`)
      .on("broadcast", { event: "email_confirmed" }, () => {
        navigate("/login", { replace: true });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [pendingUserId, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError("");
    const cleanEmail = normalizeEmail(email);

    const next: Errors = {};
    if (!name.trim()) next.name = "Nama wajib diisi.";
    if (!isCampusEmail(cleanEmail))
      next.email =
        "Gunakan surel kampus (@students.usu.ac.id atau @usu.ac.id).";
    if (password.length < 8) next.password = "Kata sandi minimal 8 karakter.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: { name: name.trim() },
        emailRedirectTo: window.location.origin + "/login",
      },
    });
    setLoading(false);

    if (error) return setFormError("Pendaftaran gagal: " + error.message);
    if (data.user && data.user.identities && data.user.identities.length === 0) {
      return setFormError("Surel ini sudah terdaftar. Silakan masuk.");
    }
    if (data.user) setPendingUserId(data.user.id);
    setSent(true);
    startCooldown();
  }

  async function handleResend() {
    if (resendLock.current || cooldown > 0) return;
    resendLock.current = true;
    setFormError("");
    startCooldown();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: normalizeEmail(email),
    });
    resendLock.current = false;
    if (error) setFormError("Gagal mengirim ulang: " + error.message);
  }

  if (sent) {
    return (
      <AuthLayout>
        <h2 className="font-display text-3xl font-semibold tracking-tight">
          Cek surel Anda
        </h2>
        <p className="mt-3 text-sm leading-6 text-gray-600">
          Tautan verifikasi dikirim ke{" "}
          <span className="font-medium text-gray-900">
            {normalizeEmail(email)}
          </span>
          . Tautan berlaku 24 jam.
        </p>
        {formError && (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {formError}
          </p>
        )}
        <div className="mt-6 space-y-3">
          <Button type="button" onClick={handleResend} disabled={cooldown > 0}>
            {cooldown > 0
              ? `Kirim ulang (${cooldown} dtk)`
              : "Kirim ulang tautan"}
          </Button>
          <Link to="/login" className="block">
            <Button type="button" variant="outline">
              Ke halaman masuk
            </Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h2 className="font-display text-3xl font-semibold tracking-tight text-gray-900">
        Buat akun baru
      </h2>
      <p className="mt-2 text-sm text-gray-500">
        Daftar dengan surel kampus untuk mulai melapor dan mencari barang.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-5">
        <TextField
          label="Nama lengkap"
          autoComplete="name"
          placeholder="Nama sesuai identitas"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
        />
        <TextField
          label="Alamat surel kampus"
          type="email"
          autoComplete="email"
          placeholder="nama@students.usu.ac.id"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <TextField
          label="Kata sandi"
          type="password"
          autoComplete="new-password"
          placeholder="Minimal 8 karakter"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint="Gunakan minimal 8 karakter."
        />
        {formError && (
          <p
            role="alert"
            className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {formError}
          </p>
        )}
        <Button type="submit" loading={loading}>
          {loading ? "Memproses..." : "Daftar"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Sudah punya akun?{" "}
        <Link
          to="/login"
          className="font-medium text-brand-800 hover:underline"
        >
          Masuk
        </Link>
      </p>
    </AuthLayout>
  );
}