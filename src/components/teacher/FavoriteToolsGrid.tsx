"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { TOOL_REGISTRY, type ToolRegistryEntry } from "@/lib/tool-registry"

export function FavoriteToolsGrid() {
  const [keys,    setKeys]    = useState<string[] | null>(null)

  useEffect(() => {
    fetch("/api/tool-favorites")
      .then((r) => (r.ok ? r.json() : { keys: [] }))
      .then((d: { keys: string[] }) => setKeys(d.keys ?? []))
      .catch(() => setKeys([]))
  }, [])

  // Resolve favorited keys against the static registry, preserving registry order
  const favTools: ToolRegistryEntry[] =
    keys === null ? [] : TOOL_REGISTRY.filter((t) => keys.includes(t.key))

  async function unstar(toolKey: string) {
    setKeys((prev) => (prev ? prev.filter((k) => k !== toolKey) : prev))
    await fetch("/api/tool-favorites", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ toolKey }),
    }).catch(() => {})
  }

  // Still loading — render nothing to avoid layout shift
  if (keys === null) return null

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-h2">常用工具 · Favorites</h2>
      </div>

      {favTools.length === 0 ? (
        <div
          className="card p-6 text-center text-caption"
          style={{ color: "var(--color-ink-300)" }}
        >
          在工具頁面點擊 ☆ 即可加入常用工具，方便快速開啟。
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {favTools.map((t) => (
            <div key={t.key} className="relative">
              <Link href={t.href}>
                <div
                  className="card p-5 hover:shadow-card-md transition-shadow cursor-pointer h-full"
                  style={{ borderTop: `3px solid var(--color-${t.colorVar})` }}
                >
                  <h3 className="text-h3 mb-1 pr-6">{t.label}</h3>
                  <p
                    className="text-caption mt-3 font-medium"
                    style={{ color: `var(--color-${t.colorVar})` }}
                  >
                    開啟 →
                  </p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => unstar(t.key)}
                aria-label="取消常用"
                title="取消常用"
                className="absolute top-3 right-3 transition-transform hover:scale-110 active:scale-90"
                style={{ color: `var(--color-${t.colorVar})` }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
