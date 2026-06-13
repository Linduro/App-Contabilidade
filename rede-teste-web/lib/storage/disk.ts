import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR } from "@/lib/uploads";
import type { StorageProvider, StoredObject } from "./types";

export const diskStorage: StorageProvider = {
  async putObject(key, body, contentType) {
    const normalized = key.replace(/^\/+/, "").replace(/\\/g, "/");
    const diskPath = path.join(UPLOAD_DIR, normalized);
    await mkdir(path.dirname(diskPath), { recursive: true });
    await writeFile(diskPath, body);
    return {
      publicPath: `/uploads/${normalized}`,
      contentType,
    };
  },
};
