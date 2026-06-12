import type { ReactNode } from "react";
import { ProfileShell } from "@/components/rede-teste/profile/profile-shell";

export default function RedeTesteProfileLayout({ children }: { children: ReactNode }) {
  return <ProfileShell>{children}</ProfileShell>;
}
