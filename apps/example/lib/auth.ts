"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAppBase } from "./appbase";

export function useAuthSession() {
  const appBase = useAppBase();
  const [session, setSession] = useState(() => appBase.auth.getSession());

  const refreshSession = () => setSession(appBase.auth.getSession());

  return {
    session,
    hasSession: Boolean(session),
    refreshSession,
  };
}

export function useRequireAuth(redirectTo = "/sign-in") {
  const router = useRouter();
  const { hasSession } = useAuthSession();

  useEffect(() => {
    if (!hasSession) router.replace(redirectTo);
  }, [hasSession, router, redirectTo]);

  return { hasSession };
}

