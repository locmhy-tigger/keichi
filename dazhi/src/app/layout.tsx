import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "AI 大智若愚",
  description: "智能課堂學習平台",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-HK">
      <body className="font-sans">{children}</body>
    </html>
  )
}
