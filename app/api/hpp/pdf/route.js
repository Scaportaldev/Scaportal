import { handle, readJson, pdfResponse } from "@/server/http";
import { requireSuperadmin } from "@/server/auth";
import { buildHppPdf } from "@/server/pdf/hppPdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handle(async (req) => {
  await requireSuperadmin(req);
  const body = await readJson(req);
  const bytes = await buildHppPdf({
    name: body.name || "HPP",
    customer: body.customer || "",
    notes: body.notes || "",
    company: body.company || "Percetakan SCA",
    result: body.result || {},
  });
  const fname = String(body.name || "hpp").replace(/\s+/g, "_");
  return pdfResponse(bytes, `HPP_${fname}.pdf`);
});
