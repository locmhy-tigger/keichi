"use client"

import { useRef, useState } from "react"

export function AskICHI() {
  const [query,   setQuery]   = useState("")
  const [answer,  setAnswer]  = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q || loading) return

    setLoading(true)
    setAnswer(null)
    setError(null)

    try {
      const res = await fetch("/api/ai/query", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ query: q }),
      })
      if (!res.ok) throw new Error("request failed")
      const data = await res.json()
      setAnswer(data.answer)
    } catch {
      setError("無法取得回答，請稍後再試。")
    } finally {
      setLoading(false)
    }
  }

  function handleClear() {
    setQuery("")
    setAnswer(null)
    setError(null)
    inputRef.current?.focus()
  }

  const inputStyle = {
    border:     "1px solid var(--color-border)",
    background: "var(--color-surface)",
    color:      "var(--color-ink-900)",
  }

  return (
    <div className="card p-5 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-white font-bold"
          style={{ background: "var(--color-accent)", fontSize: 10 }}
        >
          AI
        </div>
        <h2 className="text-h3">問 ICHI</h2>
        <span className="text-caption" style={{ color: "var(--color-ink-400)" }}>
          · 根據公告及行為記錄回答
        </span>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="例：本週有哪些緊急公告？陳大文近期有何行為記錄？"
          className="flex-1 px-3 py-2 text-body rounded-input border outline-none"
          style={inputStyle}
          disabled={loading}
        />
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="px-4 py-2 rounded-input text-body font-medium text-white shrink-0 transition-opacity"
          style={{
            background: "var(--color-accent)",
            opacity: !query.trim() || loading ? 0.6 : 1,
          }}
        >
          {loading ? "…" : "問"}
        </button>
      </form>

      {/* Loading */}
      {loading && (
        <p className="text-caption animate-pulse" style={{ color: "var(--color-ink-400)" }}>
          ICHI 正在思考中…
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="text-caption" style={{ color: "var(--color-discipline)" }}>
          {error}
        </p>
      )}

      {/* Answer */}
      {answer && (
        <div
          className="rounded-input p-4 space-y-2"
          style={{ background: "var(--color-accent-soft)" }}
        >
          <p className="text-caption font-medium" style={{ color: "var(--color-accent)" }}>
            ICHI 回答
          </p>
          <p
            className="text-body whitespace-pre-wrap leading-relaxed"
            style={{ color: "var(--color-ink-900)" }}
          >
            {answer}
          </p>
          <button
            type="button"
            onClick={handleClear}
            className="text-caption transition-opacity hover:opacity-60"
            style={{ color: "var(--color-ink-400)" }}
          >
            清除
          </button>
        </div>
      )}
    </div>
  )
}
