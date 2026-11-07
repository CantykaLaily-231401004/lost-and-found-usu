import type { Report } from "../store/lofiStore";
import Badge, { type BadgeTone } from "./Badge";
import { categoryIcon } from "../utils/categoryIcon";
import Icon from "./Icon";

/** Foto pertama laporan, atau ubin kategori bila tidak ada foto. */
export default function ReportThumb({
  report,
  className = "",
  iconClass = "size-10",
}: {
  report: Pick<Report, "photos" | "category" | "description">;
  className?: string;
  iconClass?: string;
}) {
  const photo = report.photos[0];
  return photo ? (
    <img
      src={photo}
      alt={`Foto: ${report.description}`}
      className={`object-cover ${className}`}
    />
  ) : (
    <div
      aria-hidden
      className={`flex items-center justify-center bg-gradient-to-br from-brand-50 to-surface text-brand-800/35 ${className}`}
    >
      <Icon name={categoryIcon(report.category)} className={iconClass} />
    </div>
  );
}

const STATUS_TONE: Record<string, BadgeTone> = {
  Tersedia: "green",
  Aktif: "outline",
  Dicadangkan: "amber",
  Diserahkan: "gray",
  Ditutup: "graySoft",
};

export function ReportStatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? "graySoft"}>{status}</Badge>;
}

export function ReportKindBadge({
  kind,
  solid = false,
}: {
  kind: "lost" | "found";
  solid?: boolean;
}) {
  return kind === "lost" ? (
    <Badge tone={solid ? "red" : "redSoft"}>
      <Icon name="alert" className="size-3" />
      {solid ? "Hilang" : "Kehilangan"}
    </Badge>
  ) : (
    <Badge tone={solid ? "green" : "soft"}>
      <Icon name="check" className="size-3" />
      Temuan
    </Badge>
  );
}
