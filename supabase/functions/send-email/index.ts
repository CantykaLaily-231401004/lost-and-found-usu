import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Opsional: isi dengan `supabase secrets set APP_URL=https://alamat-aplikasi-anda`
// Kalau kosong, tombol "Buka Aplikasi" tidak ditampilkan.
const APP_URL = Deno.env.get("APP_URL") ?? "";

type Tpl = { subject: string; heading: string; icon: string; color: string };

const GREEN = "#1b5c38";
const AMBER = "#b7791f";
const RED = "#b42318";
const BLUE = "#175cd3";

const TEMPLATES: Record<string, Tpl> = {
  klaim_diajukan: { subject: "Klaim Anda berhasil diajukan", heading: "Klaim berhasil diajukan", icon: "📝", color: BLUE },
  klaim_baru: { subject: "Ada klaim baru menunggu verifikasi", heading: "Klaim baru menunggu verifikasi", icon: "📥", color: AMBER },
  klaim_disetujui: { subject: "Klaim Anda disetujui", heading: "Klaim disetujui", icon: "✅", color: GREEN },
  klaim_ditolak: { subject: "Klaim Anda ditolak", heading: "Klaim ditolak", icon: "❌", color: RED },
  klaim_dibatalkan: { subject: "Klaim Anda dibatalkan", heading: "Klaim dibatalkan", icon: "⚠️", color: AMBER },
  klaim_selesai: { subject: "Klaim Anda selesai", heading: "Klaim selesai", icon: "🎉", color: GREEN },
  jadwal_diajukan: { subject: "Jadwal serah terima diajukan", heading: "Jadwal serah terima diajukan", icon: "📅", color: BLUE },
  jadwal_dibuat: { subject: "Jadwal serah terima ditetapkan", heading: "Jadwal serah terima ditetapkan", icon: "📅", color: GREEN },
  jadwal_diubah: { subject: "Jadwal serah terima diubah", heading: "Jadwal serah terima diubah", icon: "🔄", color: AMBER },
  jadwal_dibatalkan: { subject: "Jadwal serah terima dibatalkan", heading: "Jadwal serah terima dibatalkan", icon: "⚠️", color: RED },
  konfirmasi_diperlukan: { subject: "Konfirmasi Anda diperlukan", heading: "Konfirmasi diperlukan", icon: "🔔", color: AMBER },
  kode_pengambilan: { subject: "Kode pengambilan barang", heading: "Kode pengambilan barang", icon: "🔑", color: BLUE },
  serah_terima_selesai: { subject: "Serah terima selesai", heading: "Serah terima selesai", icon: "🎉", color: GREEN },
  status_temuan: { subject: "Status laporan temuan berubah", heading: "Status laporan berubah", icon: "📦", color: BLUE },
  peran_admin: { subject: "Peran admin Anda diperbarui", heading: "Peran admin diperbarui", icon: "🛡️", color: BLUE },
};

const FALLBACK: Tpl = {
  subject: "Notifikasi baru",
  heading: "Notifikasi baru",
  icon: "🔔",
  color: BLUE,
};

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!)
  );

function renderHtml(tpl: Tpl, pesan: string): string {
  const button = APP_URL
    ? `<tr><td align="center" style="padding:8px 32px 32px;">
         <a href="${esc(APP_URL)}" style="display:inline-block;background:${GREEN};color:#ffffff;
            text-decoration:none;font-weight:600;font-size:15px;padding:12px 28px;border-radius:999px;">
           Buka Aplikasi
         </a>
       </td></tr>`
    : `<tr><td style="padding:0 32px 32px;color:#475467;font-size:14px;">
         Buka aplikasi Lost &amp; Found USU untuk melihat detail selengkapnya.
       </td></tr>`;

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(tpl.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#eef1ec;">
  <!-- teks pratinjau di daftar inbox -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(pesan)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1ec;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;
                    font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
        <!-- header -->
        <tr><td style="background:${GREEN};padding:20px 32px;color:#ffffff;">
          <div style="font-size:18px;font-weight:700;letter-spacing:.2px;">Lost &amp; Found USU</div>
          <div style="font-size:12px;opacity:.8;margin-top:2px;">Universitas Sumatera Utara</div>
        </td></tr>
        <!-- judul -->
        <tr><td style="padding:32px 32px 8px;">
          <div style="display:inline-block;background:${tpl.color}1a;color:${tpl.color};
                      font-size:13px;font-weight:600;padding:6px 12px;border-radius:999px;">
            ${tpl.icon}&nbsp; ${esc(tpl.heading)}
          </div>
        </td></tr>
        <!-- isi pesan -->
        <tr><td style="padding:16px 32px 24px;color:#101828;font-size:16px;line-height:1.6;">
          ${esc(pesan)}
        </td></tr>
        ${button}
        <!-- footer -->
        <tr><td style="background:#f6f8f5;padding:20px 32px;color:#667085;font-size:12px;line-height:1.5;
                       border-top:1px solid #e4e7ec;">
          Surel ini dikirim otomatis oleh sistem Lost &amp; Found USU. Mohon tidak membalas surel ini.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const basicAuth = "Basic " + btoa(
  `${Deno.env.get("MAILJET_API_KEY")}:${Deno.env.get("MAILJET_SECRET_KEY")}`,
);

Deno.serve(async (req) => {
  if (req.headers.get("x-cron-secret") !== Deno.env.get("CRON_SECRET")) {
    return new Response("unauthorized", { status: 401 });
  }

  const { data: batch, error } = await supabase.rpc("internal_claim_outbox", { p_limit: 20 });
  if (error) return new Response(error.message, { status: 500 });

  let sent = 0, failed = 0;
  for (const row of batch ?? []) {
    try {
      const tpl = TEMPLATES[row.event_type] ?? FALLBACK;
      const res = await fetch("https://api.mailjet.com/v3.1/send", {
        method: "POST",
        headers: { Authorization: basicAuth, "Content-Type": "application/json" },
        body: JSON.stringify({
          Messages: [{
            From: {
              Email: Deno.env.get("MAIL_FROM_EMAIL"),
              Name: Deno.env.get("MAIL_FROM_NAME"),
            },
            To: [{ Email: row.recipient_email }],
            Subject: `[Lost & Found USU] ${tpl.subject}`,
            TextPart: `${row.pesan}\n\n— Lost & Found USU`,
            HTMLPart: renderHtml(tpl, row.pesan),
          }],
        }),
      });
      const body = await res.json().catch(() => ({}));
      const status = body?.Messages?.[0]?.Status;
      if (!res.ok || status !== "success") {
        throw new Error(`${res.status} ${JSON.stringify(body).slice(0, 500)}`);
      }
      await supabase.rpc("internal_outbox_mark", { p_outbox_id: row.outbox_id, p_ok: true });
      sent++;
    } catch (e) {
      await supabase.rpc("internal_outbox_mark", {
        p_outbox_id: row.outbox_id, p_ok: false, p_error: String(e),
      });
      failed++;
    }
  }
  return Response.json({ sent, failed });
});