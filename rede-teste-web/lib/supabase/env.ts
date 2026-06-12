export function getSupabaseUrl(): string | null {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    null
  );
}

export function getSupabasePublishableKey(): string | null {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    null
  );
}

export function getSupabaseSecretKey(): string | null {
  const legacy = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (legacy?.startsWith("eyJ")) return legacy;
  if (secret?.startsWith("sb_secret_")) return secret;
  return legacy || secret || null;
}

export function getSupabaseStorageBucket(): string {
  return process.env.SUPABASE_STORAGE_BUCKET?.trim() || "rede-teste";
}

export function isSupabaseConfigured(): boolean {
  return !!(getSupabaseUrl() && getSupabasePublishableKey());
}

export function isSupabaseServerConfigured(): boolean {
  return !!(getSupabaseUrl() && getSupabaseSecretKey());
}

export function isSupabaseStorageConfigured(): boolean {
  return isSupabaseServerConfigured();
}
