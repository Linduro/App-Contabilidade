export const JQ_REF_HANDLE_KEY = "jq_ref_handle";

export function saveJqReferralHandle(handle: string) {
  if (typeof window === "undefined") return;
  const h = handle.replace(/^@/, "").toLowerCase().trim();
  if (!h) return;
  sessionStorage.setItem(JQ_REF_HANDLE_KEY, h);
}

export function getJqReferralHandle(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(JQ_REF_HANDLE_KEY);
}

export function clearJqReferralHandle() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(JQ_REF_HANDLE_KEY);
}
