"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  getRedeTesteTheme,
  type RedeTesteThemeMode,
} from "@/components/rede-teste/juridiques-theme-scope";

/** Garante variáveis de tema em portais Radix (dialog, select) fora do shell. */
export function RedeTestePortalTheme({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [mode, setMode] = React.useState<RedeTesteThemeMode>("dark");

  React.useEffect(() => {
    setMode(getRedeTesteTheme());
    const onStorage = (e: StorageEvent) => {
      if (e.key === "rede-teste-theme") setMode(getRedeTesteTheme());
    };
    const onCustom = () => setMode(getRedeTesteTheme());
    window.addEventListener("storage", onStorage);
    window.addEventListener("rede-teste-theme-change", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("rede-teste-theme-change", onCustom);
    };
  }, []);

  return (
    <div
      data-rede-teste
      className={cn(
        "jq-theme text-[var(--jq-text)]",
        mode === "dark" ? "jq-dark" : "jq-light",
        className,
      )}
    >
      {children}
    </div>
  );
}
