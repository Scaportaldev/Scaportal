import { NextResponse } from "next/server";
import { handle, readJson } from "@/server/http";
import { getCurrentUser, clearAuthCookie } from "@/server/auth";
import { closeActivity } from "@/server/logs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  const current = await getCurrentUser(req);
  const body = await readJson(req);
  const label = body.type === "auto" ? "Logout otomatis (tidak aktif)" : "Logout";

  if (current.sid) {
    await closeActivity(current.sid, label);
  }
  return clearAuthCookie(NextResponse.json({ success: true }));
});
