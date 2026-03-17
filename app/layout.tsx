import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "Studio Cinq — Client Portal",
  description: "Private client workspace for Studio Cinq projects.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
