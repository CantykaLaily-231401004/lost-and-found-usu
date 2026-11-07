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
  pin: "M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11zM12 12a2 2 0 100-4 2 2 0 000 4z",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2",
  info: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 11v5M12 8v.01",
  mail: "M4 6h16v12H4zM4 7l8 6 8-6",
  bag: "M6 8h12l1 12H5L6 8zM9 8V7a3 3 0 016 0v1",
  laptop: "M5 6h14v9H5zM3 18h18",
  key: "M12 11l8-8M16 7l3 3M8 19a4 4 0 100-8 4 4 0 000 8z",
  card: "M3 6h18v12H3zM3 10h18M7 15h4",
  glasses:
    "M3 14a3.5 3.5 0 107 0 3.5 3.5 0 00-7 0zM14 14a3.5 3.5 0 107 0 3.5 3.5 0 00-7 0zM10 14h4M3 14l1-5M21 14l-1-5",
  shirt: "M8 4l-5 3 2 4 2-1v10h10V10l2 1 2-4-5-3a4 4 0 01-8 0z",
  box: "M4 8l8-4 8 4v8l-8 4-8-4zM4 8l8 4 8-4M12 12v8",
  plus: "M12 5v14M5 12h14",
  logout: "M9 4H5v16h4M16 8l4 4-4 4M20 12H9",
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
