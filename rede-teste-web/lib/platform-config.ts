import {
  isSupabaseConfigured,
  isSupabaseServerConfigured,
  isSupabaseStorageConfigured,
} from "@/lib/supabase/env";

export { isSupabaseConfigured, isSupabaseServerConfigured, isSupabaseStorageConfigured };

export function isStripeConfigured() {
  return false;
}

export function isS3StorageConfigured() {
  return false;
}

export function isDirectUploadConfigured() {
  return isSupabaseStorageConfigured();
}

export function isOabRegistryVerified(): boolean {
  return false;
}

export function isRedeTesteIaEnabled(): boolean {
  return false;
}

export function isJuridiquesIaEnabled(): boolean {
  return false;
}
