import type { ReactNode } from "react";

/** Label dengan tanda bintang merah untuk kolom wajib. */
export default function Req({ children }: { children: ReactNode }) {
  return (
    <>
      {children} <span className="text-red-600">*</span>
    </>
  );
}
