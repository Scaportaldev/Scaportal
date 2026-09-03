import { handle, json } from "@/server/http";
import { getCurrentUser } from "@/server/auth";
import { getDb } from "@/server/mongo";
import { collectionFor, NAME_FIELD } from "@/server/mutations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async (req, { params }) => {
  await getCurrentUser(req);
  const { type } = await params;
  const collection = collectionFor(type);
  const db = await getDb();
  const vals = await db.collection(collection).distinct(NAME_FIELD[type]);
  return json(vals.filter(Boolean).sort((a, b) => String(a).localeCompare(String(b))));
});
