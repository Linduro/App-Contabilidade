import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import {
  getUploadDiskPath,
  mimeForUploadFilename,
  statEtag,
  validateJqUploadPathSegments,
  validateUploadPathSegments,
} from "@/lib/uploads";

export const runtime = "nodejs";

type Params = { params: Promise<{ path: string[] }> };

function nodeToWeb(stream: Readable): ReadableStream<Uint8Array> {
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
}

export async function GET(req: Request, { params }: Params) {
  const { path: segments } = await params;

  try {
    let diskPath: string;
    let contentType = "application/octet-stream";

    if (segments.length === 2) {
      const { userId, filename } = validateUploadPathSegments(segments);
      diskPath = getUploadDiskPath(userId, filename);
      contentType = mimeForUploadFilename(filename);
    } else if (segments.length >= 4) {
      diskPath = validateJqUploadPathSegments(segments);
      contentType = mimeForUploadFilename(segments[segments.length - 1]!);
    } else {
      return new NextResponse(null, { status: 404 });
    }

    const info = await stat(diskPath);
    if (!info.isFile()) {
      return new NextResponse(null, { status: 404 });
    }

    const etag = statEtag(info.mtimeMs, info.size);
    if (req.headers.get("if-none-match") === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }

    return new NextResponse(nodeToWeb(createReadStream(diskPath)), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
        ETag: etag,
        "Content-Length": String(info.size),
        "Accept-Ranges": "bytes",
      },
    });
  } catch {
    return new NextResponse(null, { status: 404 });
  }
}
