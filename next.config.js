/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ["your-supabase-project.supabase.co"],
  },
  // Keep puppeteer-core + @sparticuz/chromium out of the bundler so the
  // Chromium binary ships with the function instead of being tree-shaken
  // / inlined. Without this Vercel can't locate /bin and `page.pdf()` fails.
  serverExternalPackages: ["puppeteer-core", "@sparticuz/chromium"],
  // Tell Next's output tracing to include every file under @sparticuz/chromium
  // (the brotli-compressed binary + helpers) in the PDF route bundle.
  outputFileTracingIncludes: {
    "/api/pdf/brand-kit/[projectId]": [
      "./node_modules/@sparticuz/chromium/**",
    ],
  },
}

module.exports = nextConfig
