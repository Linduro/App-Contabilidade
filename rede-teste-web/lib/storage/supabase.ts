import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  getSupabaseStorageBucket,
  getSupabaseUrl,
  isSupabaseServerConfigured,
} from "@/lib/supabase/env";
import type { StorageProvider, StoredObject } from "./types";

function publicObjectUrl(objectKey: string): string {
  const base = getSupabaseUrl()!.replace(/\/$/, "");
  const bucket = getSupabaseStorageBucket();
  const key = objectKey.replace(/^\/+/, "");
  return `${base}/storage/v1/object/public/${bucket}/${key}`;
}

export async function createSupabaseStorage(): Promise<StorageProvider | null> {
  if (!isSupabaseServerConfigured()) return null;

  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const bucket = getSupabaseStorageBucket();

  return {
    async putObject(key, body, contentType): Promise<StoredObject> {
      const objectKey = key.replace(/^\/+/, "").replace(/\\/g, "/");
      const { error } = await supabase.storage.from(bucket).upload(objectKey, body, {
        contentType,
        upsert: true,
        cacheControl: "public, max-age=31536000, immutable",
      });
      if (error) throw new Error(`Supabase Storage: ${error.message}`);
      return {
        publicPath: publicObjectUrl(objectKey),
        contentType,
      };
    },

    async getPresignedPutUrl(key, contentType, expiresSec = 900) {
      const objectKey = key.replace(/^\/+/, "").replace(/\\/g, "/");
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUploadUrl(objectKey, { upsert: true });
      if (error || !data?.signedUrl) {
        throw new Error(error?.message ?? "URL de upload indisponível");
      }
      void contentType;
      void expiresSec;
      return data.signedUrl;
    },
  };
}
