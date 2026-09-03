/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Output standalone: hasil build berisi server.js mandiri + node_modules minimal,
  // dipakai Dockerfile untuk deploy ke Coolify/VPS (image kecil, tanpa yarn di runtime).
  output: 'standalone',
  // Sembunyikan badge/indicator dev Next.js agar tidak menutupi elemen UI
  // (mengganggu klik tombol di pojok layar saat preview & automated test).
  devIndicators: false,
  eslint: { ignoreDuringBuilds: true },
  // Root workspace eksplisit (repo punya shim /app/frontend untuk supervisor preview)
  outputFileTracingRoot: __dirname,
  // Izinkan akses dev dari domain preview Emergent (cross-origin /_next/*)
  allowedDevOrigins: [
    'quick-setup-env.preview.emergentagent.com',
    'quick-setup-env.cluster-12.preview.emergentcf.cloud',
    '*.preview.emergentagent.com',
    '*.preview.emergentcf.cloud',
    '*.cluster-12.preview.emergentcf.cloud',
    '*.emergentagent.net',
    '*.emergentagent.com',
    '*.emergentcf.cloud',
  ],
  // Semua halaman dirender sebagai SPA (react-router di client), jadi tidak perlu
  // image optimization server-side.
  images: { unoptimized: true },
  serverExternalPackages: ['mysql2', 'bcryptjs'],
};

module.exports = nextConfig;
