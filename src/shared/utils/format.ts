const dateFmt = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
});

/** "2026-11-07" atau ISO penuh jadi "7 Nov 2026". */
export function formatDate(value: string) {
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value);
  return Number.isNaN(d.getTime()) ? value : dateFmt.format(d);
}

/** ISO penuh jadi "7 Nov 2026, 17.00". */
export function formatDateTime(value: string) {
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : `${dateFmt.format(d)}, ${timeFmt.format(d)}`;
}

export function shorten(text: string, max = 48) {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
}
