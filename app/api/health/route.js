import { handle, json } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handle(async () => json({ status: "ok" }));
