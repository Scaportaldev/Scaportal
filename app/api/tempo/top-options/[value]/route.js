import { handle, json, HttpError } from "@/server/http";
import { requireSuperadmin } from "@/server/auth";
import { ensureTopSeed, saveTopOptions } from "@/server/tempo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const DELETE = handle(async (req, { params }) => {
  await requireSuperadmin(req);
  const { value } = await params;
  const target = decodeURIComponent(value);
  if (target === "Cicilan") throw new HttpError(400, "Opsi 'Cicilan' tidak dapat dihapus");
  const values = (await ensureTopSeed()).filter((v) => v !== target);
  return json({ values: await saveTopOptions(values) });
});
