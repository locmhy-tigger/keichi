"use client"

import { useCallback, useEffect, useState } from "react"

// 收功課 — tap a student to mark 欠交, tap again to undo. One list of who has
// missed this homework, shared by the 課代表 collecting it and the teacher, so
// both always see the same thing whoever recorded each miss.

type Miss = { id: string; studentId: string; resolved: boolean; recordedBy: string | null; byRep: boolean; mine: boolean }
type Student = { id: string; tag: string; name: string | null }

const RED = "#7c3aed"

export function CollectSheet({
  classId, homeworkId, teacher, sessionId, onClose, onChanged,
}: {
  classId: string
  homeworkId: string
  /** Teachers may undo anyone's record; a rep only their own, before follow-up. */
  teacher: boolean
  sessionId?: string | null
  onClose: () => void
  onChanged?: () => void
}) {
  const [title,   setTitle]   = useState("")
  const [roster,  setRoster]  = useState<Student[]>([])
  const [misses,  setMisses]  = useState<Miss[]>([])
  const [busy,    setBusy]    = useState<string | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const base = `/api/classes/${classId}/homework/${homeworkId}/misses`

  const load = useCallback(async () => {
    const res = await fetch(base)
    const d = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) { setError(d?.error ?? `載入失敗 (${res.status})`); return }
    setTitle([d.homework.subject, d.homework.title].filter(Boolean).join("：")); setRoster(d.roster); setMisses(d.misses)
  }, [base])

  useEffect(() => { load() }, [load])

  async function toggle(s: Student) {
    if (busy) return
    const m = misses.find((x) => x.studentId === s.id)
    if (m && !teacher && (!m.mine || m.resolved)) {
      setError(m.resolved ? "老師已跟進，不可以取消" : `由${m.recordedBy ?? "其他人"}記錄，只有老師可以取消`)
      return
    }
    setBusy(s.id); setError(null)
    const res = m
      ? await fetch(`${base}?studentId=${s.id}`, { method: "DELETE" })
      : await fetch(base, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ studentIds: [s.id], sessionId: sessionId ?? undefined }),
        })
    const d = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) { setError(d?.error ?? `操作失敗 (${res.status})`); return }
    setMisses(d.misses)
    onChanged?.()
  }

  const missed = new Map(misses.map((m) => [m.studentId, m]))

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto rounded-t-card sm:rounded-card p-5 space-y-3">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <h3 className="text-h3">收功課：{title || "…"}</h3>
            <p className="text-caption" style={{ color: "var(--color-ink-400)" }}>點未交的同學（再點一次取消）</p>
          </div>
          <button onClick={onClose} className="px-3 py-1.5 rounded-input border text-caption" style={{ border: "1px solid var(--color-border)" }}>完成</button>
        </div>

        {!loading && (
          <p className="text-body">
            已交 <b>{roster.length - misses.length}</b>／{roster.length}
            <span className="ml-4" style={{ color: RED }}>欠交 <b>{misses.length}</b></span>
          </p>
        )}
        {error && <p className="text-caption" style={{ color: "var(--color-discipline)" }}>⚠ {error}</p>}
        {loading && <p className="text-caption" style={{ color: "var(--color-ink-400)" }}>載入中…</p>}

        <div className="grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(104px, 1fr))" }}>
          {roster.map((s) => {
            const m = missed.get(s.id)
            const locked = !!m && !teacher && (!m.mine || m.resolved)
            return (
              <button key={s.id} onClick={() => toggle(s)} disabled={busy === s.id}
                className="rounded-input px-2 py-2 text-left"
                style={{
                  background: m ? RED : "var(--color-surface)",
                  color: m ? "#fff" : "var(--color-ink-900)",
                  border: `1px solid ${m ? RED : "var(--color-border)"}`,
                  opacity: busy === s.id ? 0.6 : 1, touchAction: "manipulation",
                }}>
                <span className="block text-caption tabular-nums opacity-70">{s.tag || "—"}</span>
                <span className="block text-body font-medium truncate">{s.name ?? "—"}</span>
                <span className="block text-[10px]" style={{ opacity: 0.85 }}>
                  {m ? (m.resolved ? "欠交 · 已跟進" : locked ? `欠交 · ${m.recordedBy ?? ""}記錄` : "欠交") : "已交"}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
