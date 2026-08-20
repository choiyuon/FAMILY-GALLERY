import { NextResponse } from "next/server";
import { runCleanup } from "@/lib/media/cleanup";
import { isStorageConfigured } from "@/lib/storage/blob";

// The one Vercel Cron slot this project gets (AGENTS.md §6): daily at 03:00 KST.
export const maxDuration = 60;

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!isStorageConfigured()) {
    return NextResponse.json({ error: "storage not configured" }, { status: 503 });
  }

  return NextResponse.json(await runCleanup());
}
