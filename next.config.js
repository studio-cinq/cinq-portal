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
  },
}

module.exports = nextConfig
