"use client";

import * as React from "react";

export type RedeTesteThemeMode = "light" | "dark";

const STORAGE_KEY = "rede-teste-theme";

export function getRedeTesteTheme(): RedeTesteThemeMode {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return "dark";
}

function applyRedeTesteThemeToRoot(mode: RedeTesteThemeMode) {
  const root = document.documentElement;
  root.classList.add("rt-portal-theme");
  root.classList.remove("jq-light", "jq-dark");
  root.classList.add(mode === "dark" ? "jq-dark" : "jq-light");
}

export function RedeTesteThemeScope({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = React.useState<RedeTesteThemeMode>(() =>
    typeof window !== "undefined" ? getRedeTesteTheme() : "dark",
  );

  React.useLayoutEffect(() => {
    applyRedeTesteThemeToRoot(mode);
  }, [mode]);

  React.useEffect(() => {
    setMode(getRedeTesteTheme());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setMode(getRedeTesteTheme());
    };
    const onCustom = () => setMode(getRedeTesteTheme());
    window.addEventListener("storage", onStorage);
    window.addEventListener("rede-teste-theme-change", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("rede-teste-theme-change", onCustom);
    };
  }, []);

  React.useLayoutEffect(() => {
    return () => {
      document.documentElement.classList.remove("rt-portal-theme", "jq-light", "jq-dark");
    };
  }, []);

  return (
    <div
      data-rede-teste
      className={`jq-theme min-h-svh bg-[var(--jq-bg)] text-[var(--jq-text)] ${mode === "dark" ? "jq-dark" : "jq-light"}`}
    >
      {children}
    </div>
  );
}

export function setRedeTesteTheme(mode: RedeTesteThemeMode) {
  localStorage.setItem(STORAGE_KEY, mode);
  window.dispatchEvent(new Event("rede-teste-theme-change"));
}
