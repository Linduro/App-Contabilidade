"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  getRedeTesteTheme,
  setRedeTesteTheme,
  type RedeTesteThemeMode,
} from "@/components/rede-teste/juridiques-theme-scope";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  variant?: "default" | "juridiques";
};

export function ThemeToggleMenu({ className, variant = "default" }: Props) {
  const [mounted, setMounted] = React.useState(false);
  const [mode, setMode] = React.useState<RedeTesteThemeMode>("dark");

  React.useEffect(() => {
    setMounted(true);
    setMode(getRedeTesteTheme());
    const onCustom = () => setMode(getRedeTesteTheme());
    window.addEventListener("rede-teste-theme-change", onCustom);
    return () => window.removeEventListener("rede-teste-theme-change", onCustom);
  }, []);

  function applyTheme(next: RedeTesteThemeMode) {
    setRedeTesteTheme(next);
    setMode(next);
  }

  const isJq = variant === "juridiques" || variant === "default";
  const isDark = mounted ? mode === "dark" : true;

  if (!isJq) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "size-9 shrink-0 text-[var(--jq-muted)] hover:bg-[var(--jq-surface)] hover:text-[var(--jq-text)]",
            className,
          )}
          data-testid="theme-toggle"
        >
          {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
          <span className="sr-only">Alternar tema</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="border-[var(--jq-border)] bg-[var(--jq-bg)] text-[var(--jq-text)] shadow-xl"
      >
        <DropdownMenuItem onClick={() => applyTheme("light")}>Claro</DropdownMenuItem>
        <DropdownMenuItem onClick={() => applyTheme("dark")}>Escuro</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
