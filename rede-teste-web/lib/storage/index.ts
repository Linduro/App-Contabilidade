import { diskStorage } from "./disk";
import { createSupabaseStorage } from "./supabase";
import type { StorageProvider } from "./types";

let cached: StorageProvider | null = null;

function isStorageNetworkError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return (
    msg.includes("fetch failed") ||
    msg.includes("enotfound") ||
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    msg.includes("network") ||
    msg.includes("could not resolve")
  );
}

function withStorageFallback(
  primary: StorageProvider,
  fallback: StorageProvider,
): StorageProvider {
  let preferPrimary = true;

  return {
    async putObject(key, body, contentType) {
      if (!preferPrimary) {
        return fallback.putObject(key, body, contentType);
      }
      try {
        return await primary.putObject(key, body, contentType);
      } catch (error) {
        if (!isStorageNetworkError(error)) throw error;
        console.error(
          "[storage] primário indisponível, usando disco local:",
          error instanceof Error ? error.message : error,
        );
        preferPrimary = false;
        cached = fallback;
        return fallback.putObject(key, body, contentType);
      }
    },

    async getPresignedPutUrl(key, contentType, expiresSec) {
      if (preferPrimary && primary.getPresignedPutUrl) {
        try {
          return await primary.getPresignedPutUrl(key, contentType, expiresSec);
        } catch (error) {
          if (!isStorageNetworkError(error)) throw error;
          preferPrimary = false;
          cached = fallback;
        }
      }
      if (fallback.getPresignedPutUrl) {
        return fallback.getPresignedPutUrl(key, contentType, expiresSec);
      }
      throw new Error("URL de upload indisponível");
    },
  };
}

export async function getStorageProvider(): Promise<StorageProvider> {
  if (cached) return cached;

  if (process.env.STORAGE_FORCE_DISK === "1") {
    cached = diskStorage;
    return cached;
  }

  const supabase = await createSupabaseStorage();
  if (supabase) {
    cached = withStorageFallback(supabase, diskStorage);
    return cached;
  }

  cached = diskStorage;
  return cached;
}

export function resetStorageProviderCache() {
  cached = null;
}

export type { StorageProvider, StoredObject } from "./types";
