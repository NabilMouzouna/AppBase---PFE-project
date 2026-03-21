"use client";

import { AppBase } from "@appbase/sdk";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { getPublicEnv } from "./env";

const AppBaseContext = createContext<AppBase | null>(null);

export function AppBaseProvider({ children }: { children: ReactNode }) {
  const appBase = useMemo(() => {
    const env = getPublicEnv();
    return AppBase.init({
      endpoint: env.endpoint,
      apiKey: env.apiKey,
    });
  }, []);

  return <AppBaseContext.Provider value={appBase}>{children}</AppBaseContext.Provider>;
}

export function useAppBase(): AppBase {
  const value = useContext(AppBaseContext);
  if (!value) {
    throw new Error("useAppBase must be used inside <AppBaseProvider>");
  }
  return value;
}
