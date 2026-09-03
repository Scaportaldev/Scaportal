"""Preview-only reverse proxy.

Aplikasi ini sekarang full-stack Next.js (frontend + API route handlers) di
port 3000. Ingress preview Emergent mengarahkan semua request `/api/*` ke
port 8001, jadi service ini hanya meneruskannya ke Next.js.

Di produksi (Docker/Coolify) proxy ini TIDAK dipakai — Next.js melayani /api/* secara native.
"""
import os

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import Response

TARGET = os.environ.get("NEXT_INTERNAL_URL", "http://localhost:3000")

app = FastAPI(title="LAPORAN STOK SCA — preview API proxy")

HOP_BY_HOP = {
    "content-encoding",
    "content-length",
    "transfer-encoding",
    "connection",
    "keep-alive",
    "upgrade",
}


@app.api_route("/api/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def proxy(path: str, request: Request):
    url = f"{TARGET}/api/{path}"
    body = await request.body()
    headers = {
        k: v
        for k, v in request.headers.items()
        if k.lower() not in {"host", "content-length", "accept-encoding"}
    }
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            upstream = await client.request(
                request.method, url, content=body, headers=headers,
                params=dict(request.query_params),
            )
    except httpx.ConnectError:
        return Response(
            content=b'{"detail":"Next.js belum siap, coba lagi sebentar."}',
            status_code=503, media_type="application/json",
        )

    out_headers = [
        (k, v) for k, v in upstream.headers.multi_items() if k.lower() not in HOP_BY_HOP
    ]
    resp = Response(content=upstream.content, status_code=upstream.status_code)
    for k, v in out_headers:
        if k.lower() == "set-cookie":
            resp.raw_headers.append((k.encode(), v.encode()))
        else:
            resp.headers[k] = v
    return resp
