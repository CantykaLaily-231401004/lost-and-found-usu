import type { SVGProps } from "react";

const paths = {
  search: "M21 21l-4.3-4.3M11 18a7 7 0 100-14 7 7 0 000 14z",
  file: "M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5zM14 3v5h5M9 13h6M9 17h6",
  clipboard:
    "M9 4h6a1 1 0 011 1v1H8V5a1 1 0 011-1zM8 6H6a1 1 0 00-1 1v13a1 1 0 001 1h12a1 1 0 001-1V7a1 1 0 00-1-1h-2M9 14l2 2 4-4",
  calendar: "M4 7h16v13H4zM4 11h16M8 3v4M16 3v4",
  bell: "M6 16V11a6 6 0 1112 0v5l2 2H4l2-2zM10 21h4",
  user: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0",
  alert: "M12 4l9 16H3L12 4zM12 10v4M12 17.5v.01",
  check: "M5 12.5l4.5 4.5L19 7.5",
  checkCircle: "M12 21a9 9 0 100-18 9 9 0 000 18zM8 12.5l3 3 5-6",
  image:
    "M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M9 9.5a.5.5 0 100-1 .5.5 0 000 1z",
  arrowLeft: "M19 12H5M11 6l-6 6 6 6",
  arrowRight: "M5 12h14M13 6l6 6-6 6",
  x: "M6 6l12 12M18 6L6 18",
  lock: "M7 11V8a5 5 0 0110 0v3M6 11h12v9H6z",
} as const;

export type IconName = keyof typeof paths;

export default function Icon({
  name,
  className = "size-5",
  ...rest
}: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
      {...rest}
    >
      <path d={paths[name]} />
    </svg>
  );
}
