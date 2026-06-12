"use client";

import { createContext, useContext } from "react";
import type { RouterOutputs } from "@/lib/trpc-client";

export type JqProfileData = RouterOutputs["juridiques"]["profileByHandle"];

const ProfileContext = createContext<JqProfileData | null>(null);

export function ProfileProvider({
  profile,
  children,
}: {
  profile: JqProfileData;
  children: React.ReactNode;
}) {
  return (
    <ProfileContext.Provider value={profile}>{children}</ProfileContext.Provider>
  );
}

export function useJqProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useJqProfile deve ser usado dentro de ProfileProvider");
  }
  return ctx;
}
