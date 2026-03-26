"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const navItems = [
    { href: "/teacher", label: "總覽", icon: "📊" },
    { href: "/teacher/missions", label: "任務", icon: "📋" },
    { href: "/teacher/points", label: "積點", icon: "⭐" },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <h1 className="font-bold text-lg">AI 大智若愚</h1>
        <span className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded-full font-medium">老師</span>
      </header>
      <main className="flex-1 pb-20">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t flex">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex-1 flex flex-col items-center py-3 text-xs gap-1 transition-colors ${
              pathname === item.href ? "text-green-600 font-medium" : "text-gray-500"
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
