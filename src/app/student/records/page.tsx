"use client"

import { useEffect, useState } from "react"

type Record = {
  id:          string
  date:        string
  className:   string
  type:        "MISCONDUCT" | "MERIT"
  description: string
  action:      string | null
  resolved:    boolean
}

export default function StudentRecordsPage() {
  const [records, setRecords] = useState<Record[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/student/records")
      .then((r) => r.ok ? r.json() : { records: [] })
      .then((d) => setRecords(d.records ?? []))
      .finally(() => setLoading(false))
  }, [])

  const merits = records.filter((r) => r.type === "MERIT").length
  const misconducts = records.filter((r) => r.type === "MISCONDUCT").length

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto">
      <h1 className="text-h1 mb-1">我的行為記錄</h1>
      <p className="text-caption mb-6" style={{ color: "var(--color-ink-400)" }}>
        由老師記錄的優點與違規紀錄。
      </p>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="card p-4 text-center">
          <p className="text-h1" style={{ color: "var(--color-curriculum)" }}>{merits}</p>
          <p className="text-caption" style={{ color: "var(--color-ink-500)" }}>優點</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-h1" style={{ color: "var(--color-discipline)" }}>{misconducts}</p>
          <p className="text-caption" style={{ color: "var(--color-ink-500)" }}>違規</p>
        </div>
      </div>

      {loading ? (
        <p className="text-body text-center py-12" style={{ color: "var(--color-ink-300)" }}>載入中…</p>
      ) : records.length === 0 ? (
        <div className="card p-8 text-center" style={{ color: "var(--color-ink-300)" }}>
          <p className="text-body">暫無記錄</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((r) => {
            const isMerit = r.type === "MERIT"
            const color = isMerit ? "var(--color-curriculum)" : "var(--color-discipline)"
            return (
              <div key={r.id} className="card p-4" style={{ borderLeft: `3px solid ${color}` }}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-caption px-2 py-0.5 rounded-pill" style={{ background: `${color}20`, color }}>
                    {isMerit ? "優點" : "違規"}
                  </span>
                  <span className="text-caption" style={{ color: "var(--color-ink-400)" }}>
                    {r.className} · {new Date(r.date).toLocaleDateString("zh-HK")}
                  </span>
                  {r.resolved && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded ml-auto" style={{ background: "var(--color-surface-2)", color: "var(--color-ink-400)" }}>
                      已處理
                    </span>
                  )}
                </div>
                <p className="text-body" style={{ color: "var(--color-ink-900)" }}>{r.description}</p>
                {r.action && (
                  <p className="text-caption mt-1" style={{ color: "var(--color-ink-500)" }}>跟進：{r.action}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
