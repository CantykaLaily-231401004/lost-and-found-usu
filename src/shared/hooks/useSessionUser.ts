import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "../../services/supabase";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  verified: boolean;
  verifiedAt: string | null;
};

function toSessionUser(u: User | null | undefined): SessionUser | null {
  if (!u) return null;
  const meta = u.user_metadata?.name;
  return {
    id: u.id,
    email: u.email ?? "",
    verifiedAt: u.email_confirmed_at ?? null,
    name:
      (typeof meta === "string" && meta.trim()) ||
      u.email?.split("@")[0] ||
      "Pengguna",
    verified: !!u.email_confirmed_at,
  };
}

/** Pengguna yang sedang masuk (hanya baca sesi Supabase, tidak mengubah apa pun). */
export function useSessionUser() {
  const [state, setState] = useState<{
    user: SessionUser | null;
    ready: boolean;
  }>({ user: null, ready: false });

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active)
        setState({ user: toSessionUser(data.session?.user), ready: true });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ user: toSessionUser(session?.user), ready: true });
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
