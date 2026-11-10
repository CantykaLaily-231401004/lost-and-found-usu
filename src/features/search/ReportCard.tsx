import { Link } from "react-router-dom";
import Icon from "../../shared/components/Icon";
import {
  ReportKindBadge,
  ReportStatusBadge,
} from "../../shared/components/ReportThumb";
import ReportThumb from "../../shared/components/ReportThumb";
import { categoryLabel, type Report } from "../../shared/store/lofiStore";
import { formatDate } from "../../shared/utils/format";

export default function ReportCard({
  report,
  mine,
  claimed,
}: {
  report: Report;
  mine: boolean;
  /** Pengguna sudah punya klaim aktif pada laporan ini. */
  claimed: boolean;
}) {
  const claimable =
    report.kind === "found" && report.status === "Tersedia" && !mine;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-white/80 bg-white/90 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative h-28">
        <ReportThumb
          report={report}
          className="size-full"
          iconClass="size-10"
        />
        <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <ReportKindBadge kind={report.kind} />
          <ReportStatusBadge status={report.status} />
        </div>
        <span className="absolute bottom-3 left-3 max-w-[85%] truncate rounded-md bg-brand-950/75 px-2 py-0.5 text-xs text-white">
          {categoryLabel(report)}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-3.5">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium leading-5 text-gray-900">
          {report.description}
        </h3>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-gray-500">
          <Icon name="pin" className="size-4 shrink-0" />
          <span className="truncate">{report.location}</span>
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
          <Icon name="calendar" className="size-4 shrink-0" />
          {formatDate(report.date)}
        </p>
        <div className="mt-auto pt-3">
          {mine ? (
            <p className="text-center text-sm font-medium text-brand-800">
              Laporan Anda
            </p>
          ) : claimable && claimed ? (
            <Link
              to="/klaim-saya"
              className="flex h-9 items-center justify-center rounded-lg border border-brand-800 text-sm font-medium text-brand-800 hover:bg-brand-50"
            >
              Klaim sudah diajukan
            </Link>
          ) : claimable ? (
            <Link
              to={`/klaim/baru/${report.id}`}
              className="flex h-10 items-center justify-center gap-2 rounded-lg bg-brand-800 text-sm font-medium text-white hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-700 focus-visible:ring-offset-2"
            >
              <Icon name="arrowRight" className="size-4 -rotate-90" />
              Ajukan Klaim
            </Link>
          ) : report.kind === "lost" && report.status === "Aktif" ? (
            <p className="flex items-center gap-2 text-sm text-red-600">
              <span className="size-1.5 rounded-full bg-red-600" />
              Sedang dicari pemiliknya
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
