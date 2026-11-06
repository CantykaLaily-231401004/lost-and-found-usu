const ALLOWED_DOMAINS = ["students.usu.ac.id", "usu.ac.id"];

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

// Domain harus sama persis, bukan sekadar mengandung teks "usu.ac.id"
export function isCampusEmail(email: string) {
  const parts = normalizeEmail(email).split("@");
  return (
    parts.length === 2 && parts[0] !== "" && ALLOWED_DOMAINS.includes(parts[1])
  );
}
