"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"

type Entry = {
  noticeId: string; activity: string; category: string
  achievement: string; dates: string[]; dept: string
}
type Student = { className: string; classNumber: string; name: string; entries: Entry[] }
type Data = {
  period: { from: string; to: string; label: string }
  noticeCount: number
  students: Student[]
}

export default function Fad8Page() {
  const [data,    setData]    = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [from,    setFrom]    = useState("")
  const [to,      setTo]      = useState("")
  const [search,  setSearch]  = useState("")
  const [open,    setOpen]    = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const qs = new URLSearchParams()
    if (from) qs.set("from", from)
    if (to)   qs.set("to", to)
    const res = await fetch(`/api/fad8/compile?${qs}`)
    if (res.ok) {
      const d: Data = await res.json()
      setData(d)
      // Reflect the resolved school year back into empty pickers.
      if (!from) setFrom(d.period.from)
      if (!to)   setTo(d.period.to)
    }
    setLoading(false)
  }, [from, to])

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data?.students ?? []
    return (data?.students ?? []).filter(
      (s) => s.name.toLowerCase().includes(q) || s.className.toLowerCase().includes(q))
  }, [data, search])

  const totalEntries = (data?.students ?? []).reduce((n, s) => n + s.entries.length, 0)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Link href="/teacher/committee/admin" className="text-caption" style={{ color: "var(--color-ink-400)" }}>← 行政</Link>
        <span style={{ color: "var(--color-ink-300)" }}>/</span>
        <h1 className="text-h1">FAD8 年度彙編</h1>
      </div>
      <p className="text-caption mb-5" style={{ color: "var(--color-ink-400)" }}>
        將全年<strong>已批核</strong>的活動通告，按學生整理成 FAD8 學生學習紀錄。資料來自通告的活動類別、獎項／表現及學生名單；草稿及已退回的通告不會計算在內。
      </p>

      {/* Controls */}
      <div className="card p-4 mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label className="text-caption block mb-1" style={{ color: "var(--color-ink-700)" }}>由</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="px-3 py-2 text-body rounded-input border"
            style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-ink-900)" }} />
        </div>
        <div>
          <label className="text-caption block mb-1" style={{ color: "var(--color-ink-700)" }}>至</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="px-3 py-2 text-body rounded-input border"
            style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-ink-900)" }} />
        </div>
        <button onClick={load}
          className="px-4 py-2 text-body font-medium rounded-input text-white"
          style={{ background: "var(--color-admin)" }}>
          重新彙編
        </button>
        <a href={`/api/fad8/export?from=${from}&to=${to}`}
          className="px-4 py-2 text-body font-medium rounded-input border"
          style={{ border: "1px solid var(--color-admin)", color: "var(--color-admin)" }}>
          匯出 Excel
        </a>
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="搜尋姓名或班別…"
          className="ml-auto px-3 py-2 text-body rounded-input border w-full sm:w-56"
          style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-ink-900)" }} />
      </div>

      {data && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "已批核通告", value: data.noticeCount },
            { label: "涉及學生",   value: data.students.length },
            { label: "學習紀錄項", value: totalEntries },
          ].map((t) => (
            <div key={t.label} className="card p-4 text-center">
              <p className="text-h1" style={{ color: "var(--color-ink-900)" }}>{t.value}</p>
              <p className="text-caption" style={{ color: "var(--color-ink-500)" }}>{t.label}</p>
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-body text-center py-12" style={{ color: "var(--color-ink-300)" }}>彙編中…</p>
      ) : shown.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-h3 mb-1">此期間內沒有可彙編的紀錄</p>
          <p className="text-caption" style={{ color: "var(--color-ink-400)" }}>
            只有<strong>已批核</strong>且附有學生名單的通告會被計算。
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {shown.map((s) => {
            const key = `${s.className}|${s.classNumber}|${s.name}`
            const isOpen = open === key
            return (
              <li key={key} className="card p-4">
                <button onClick={() => setOpen(isOpen ? null : key)} className="w-full flex items-center gap-3 text-left">
                  <span className="text-caption px-2 py-0.5 rounded-pill shrink-0"
                    style={{ background: "var(--color-surface-2)", color: "var(--color-ink-600, var(--color-ink-500))" }}>
                    {s.className}{s.classNumber ? ` ${s.classNumber}` : ""}
                  </span>
                  <span className="text-body font-medium flex-1 min-w-0 truncate" style={{ color: "var(--color-ink-900)" }}>
                    {s.name}
                  </span>
                  <span className="text-caption shrink-0" style={{ color: "var(--color-ink-400)" }}>
                    {s.entries.length} 項　{isOpen ? "▲" : "▼"}
                  </span>
                </button>

                {isOpen && (
                  <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                          {["活動名稱", "類別", "獎項／表現", "日期"].map((h) => (
                            <th key={h} className="text-left px-2 py-1.5 text-caption" style={{ color: "var(--color-ink-500)" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {s.entries.map((e, i) => (
                          <tr key={`${e.noticeId}-${i}`} style={{ borderBottom: "1px solid var(--color-border)" }}>
                            <td className="px-2 py-1.5" style={{ color: "var(--color-ink-900)" }}>{e.activity}</td>
                            <td className="px-2 py-1.5" style={{ color: "var(--color-ink-700)" }}>{e.category}</td>
                            <td className="px-2 py-1.5" style={{ color: "var(--color-ink-700)" }}>{e.achievement}</td>
                            <td className="px-2 py-1.5 text-caption" style={{ color: "var(--color-ink-500)" }}>{e.dates.join("、") || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
