import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCronAuthorized } from "@/lib/security/cron-auth";
import { publishDueScheduledPublications } from "@/lib/rede-teste/publish-scheduled";

export async function GET(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { published } = await publishDueScheduledPublications(prisma);
  return NextResponse.json({
    ok: true,
    published,
    at: new Date().toISOString(),
  });
}
