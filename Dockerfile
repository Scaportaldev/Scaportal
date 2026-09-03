# =============================================================================
# LAPORAN STOK SCA — Dockerfile produksi (Coolify / VPS)
# Multi-stage: deps -> builder -> runner (Next.js standalone, ±200 MB)
# Basis Debian slim (glibc) supaya binary `sharp` prebuilt langsung cocok.
# =============================================================================

# ---------- 1. Install dependencies ----------
FROM node:20-bookworm-slim AS deps
WORKDIR /app
COPY package.json yarn.lock .npmrc ./
RUN yarn install --frozen-lockfile --network-timeout 600000

# ---------- 2. Build ----------
FROM node:20-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Semua env aplikasi (MONGO_URL, R2_*, dst.) dibaca saat RUNTIME, bukan saat build.
RUN yarn build

# ---------- 3. Runtime ----------
FROM node:20-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Hasil `output: 'standalone'` (server.js + node_modules minimal)
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

USER node
EXPOSE 3000

# Coolify/Docker menandai container "healthy" bila /api/health menjawab 200
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
