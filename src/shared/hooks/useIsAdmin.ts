import { useEffect, useState } from "react";
import { getAdminMe, type AdminArea } from "../../services/admin";
import { useSessionUser } from "./useSessionUser";

export type AdminRole = "pusat" | "fakultas";
export type AdminSession = {
  role: AdminRole;
  faculty: string;
  areas: AdminArea[];
} | null;

type AdminState = {
  userId: string | undefined;
  session: AdminSession;
  ready: boolean;
};

let cached: AdminState = {
  userId: undefined,
  session: null,
  ready: false,
};

export function useAdminState(): { session: AdminSession; ready: boolean } {
  const { user, ready: userReady } = useSessionUser();
  const userId = user?.id;
  const [state, setState] = useState<AdminState>(() =>
    userId && cached.userId === userId
      ? cached
      : { userId: undefined, session: null, ready: false },
  );

  useEffect(() => {
    if (!userReady) return;
    if (!userId) {
      cached = { userId: undefined, session: null, ready: false };
      return;
    }
    if (cached.userId === userId && cached.ready) return;

    let active = true;
    getAdminMe()
      .then((me) => {
        if (!active) return;
        const role: AdminRole =
          me.role === "admin_pusat" ? "pusat" : "fakultas";
        const faculty =
          role === "pusat"
            ? "Area Umum Kampus"
            : me.areas.map((a) => a.nama_area).join(", ") || "Fakultas";
        const next: AdminState = {
          userId,
          session: { role, faculty, areas: me.areas },
          ready: true,
        };
        cached = next;
        setState(next);
      })
      .catch(() => {
        if (!active) return;
        const next: AdminState = { userId, session: null, ready: true };
        cached = next;
        setState(next);
      });

    return () => {
      active = false;
    };
  }, [userId, userReady]);

  const effective =
    userId && cached.userId === userId && cached.ready ? cached : state;
  const synced = !!userId && effective.userId === userId && effective.ready;
  return {
    session: synced ? effective.session : null,
    ready: userReady && (!userId || synced),
  };
}

export function useAdminSession(): AdminSession {
  return useAdminState().session;
}

export function useIsAdmin(): boolean {
  return useAdminSession() !== null;
}
