// Redirect ke Cloudflare R2 public URL. Alternatif: streaming langsung dari R2.
import { NextResponse } from "next/server";
import { handle, HttpError } from "@/server/http";
import { requireAuth } from "@/server/auth";
import { getDb, COL } from "@/server/mongo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req, { params }) => {
  await requireAuth(req);
  const { id } = await params;
  const db = await getDb();
  const rec = await db.collection(COL.poFiles).findOne({ id, is_deleted: false });
  if (!rec) throw new HttpError(404, "File tidak ditemukan");
  if (rec.public_url) return NextResponse.redirect(rec.public_url, 302);
  throw new HttpError(500, "URL R2 tidak tersedia");
});
