import { NextResponse } from "next/server";
import { handle, readJson } from "@/server/http";
import { getDb, COL, nowIso } from "@/server/mongo";
import { getCurrentUser, clearAuthCookie } from "@/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  const current = await getCurrentUser(req);
  const body = await readJson(req);
  const label = body.type === "auto" ? "Logout otomatis (tidak aktif)" : "Logout";

  if (current.sid) {
    const db = await getDb();
    await db.collection(COL.activityLogs).updateOne(
      { id: current.sid, logout_time: null },
      { $set: { logout_time: nowIso(), logout_type: label } },
    );
  }
  return clearAuthCookie(NextResponse.json({ success: true }));
});
