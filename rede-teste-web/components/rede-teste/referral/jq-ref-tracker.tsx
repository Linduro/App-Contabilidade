"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { saveJqReferralHandle } from "@/lib/rede-teste/referral-storage";

/** Persiste ?ref= do perfil para atribuição no primeiro follow. */
export function JqRefTracker() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get("ref");
    if (ref) saveJqReferralHandle(ref);
  }, [searchParams]);

  return null;
}
