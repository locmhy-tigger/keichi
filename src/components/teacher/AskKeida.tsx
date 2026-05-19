"use client"

import { useRef, useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

export function AskKeida() {
  const [isOpen,  setIsOpen]  = useState(false)
  const [query,   setQuery]   = useState("")
  const [answer,  setAnswer]  = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

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
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white z-50 transition-transform hover:scale-110 active:scale-95"
        style={{ background: "var(--color-accent)" }}
        title="問 Keida"
      >
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        ) : (
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        )}
      </button>

      {/* Floating Dialog */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-24 right-6 w-[calc(100vw-3rem)] sm:w-[400px] z-50 overflow-hidden"
          >
            <div className="card shadow-2xl flex flex-col max-h-[70vh]">
              {/* Header */}
              <div className="p-4 border-b flex items-center justify-between" style={{ background: "var(--color-accent-soft)" }}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full shrink-0 flex items-center justify-center text-white font-bold"
                    style={{ background: "var(--color-accent)", fontSize: 10 }}
                  >
                    AI
                  </div>
                  <h2 className="text-h3" style={{ color: "var(--color-accent)" }}>問 Keida</h2>
                </div>
                <span className="text-[10px]" style={{ color: "var(--color-ink-400)" }}>
                  助理分析中
                </span>
              </div>

              {/* Chat Body */}
              <div className="p-4 space-y-4 overflow-y-auto">
                <p className="text-caption text-center" style={{ color: "var(--color-ink-400)" }}>
                  根據公告及行為記錄為您解答
                </p>

                {/* Answer */}
                <AnimatePresence mode="wait">
                  {answer && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="rounded-input p-4 space-y-2"
                      style={{ background: "var(--color-surface-2)" }}
                    >
                      <p className="text-caption font-medium" style={{ color: "var(--color-accent)" }}>
                        Keida 回答
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
                        清除對話
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Loading */}
                {loading && (
                  <div className="flex justify-start">
                    <div className="rounded-input px-4 py-2 bg-gray-100 animate-pulse text-caption" style={{ color: "var(--color-ink-400)" }}>
                      Keida 正在思考中…
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <p className="text-caption text-center" style={{ color: "var(--color-discipline)" }}>
                    {error}
                  </p>
                )}
              </div>

              {/* Input Area */}
              <div className="p-4 border-t">
                <form onSubmit={handleSubmit} className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="輸入您的問題…"
                    className="flex-1 px-3 py-2 text-body rounded-input border outline-none focus:ring-2 focus:ring-blue-500/20"
                    style={inputStyle}
                    disabled={loading}
                  />
                  <button
                    type="submit"
                    disabled={!query.trim() || loading}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 transition-all hover:scale-105 active:scale-95"
                    style={{
                      background: "var(--color-accent)",
                      opacity: !query.trim() || loading ? 0.6 : 1,
                    }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                  </button>
                </form>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
