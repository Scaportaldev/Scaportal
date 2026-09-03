import { NextResponse } from "next/server";
import { ensureInit } from "@/server/init";

export class HttpError extends Error {
  constructor(status, detail) {
    super(typeof detail === "string" ? detail : "Error");
    this.status = status;
    this.detail = detail;
  }
}

export function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(detail, status = 400) {
  return NextResponse.json({ detail }, { status });
}

export function pdfResponse(bytes, filename) {
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Wrapper: jalankan init (index + seed) lalu tangani error jadi {detail}. */
export function handle(fn) {
  return async (req, ctx) => {
    try {
      await ensureInit();
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.detail, e.status);
      console.error("[api] unhandled error:", e);
      return fail(`Kesalahan server: ${e?.message || "tidak diketahui"}`, 500);
    }
  };
}

export function searchParams(req) {
  return new URL(req.url).searchParams;
}

export function qp(req, key) {
  const v = searchParams(req).get(key);
  return v === null || v === "" ? null : v;
}

export async function readJson(req) {
  try {
    return await req.json();
  } catch {
    return {};
  }
}
