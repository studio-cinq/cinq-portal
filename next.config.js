/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["your-supabase-project.supabase.co"],
  },
  experimental: {
    // Keep puppeteer-core + @sparticuz/chromium out of the bundler so the
    // Chromium binary ships with the function instead of being tree-shaken
    // / inlined. Next 14 namespace; renamed in 15 to top-level.
    serverComponentsExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
    // Include the brotli-compressed binary, the shared-library tarball, and
    // every helper file under @sparticuz/chromium. The double-glob in /**/*
    // is required for Vercel's file tracer to pull subdirectory contents like
    // bin/al2.tar.br (which holds libnss3.so).
    outputFileTracingIncludes: {
      "/api/pdf/brand-kit/[projectId]/route": [
        "./node_modules/@sparticuz/chromium/**/*",
        "./node_modules/@sparticuz/chromium/bin/**/*",
      ],
    },
  },
}

module.exports = nextConfig
