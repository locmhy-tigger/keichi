"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"

type BehaviorType = "MERIT" | "MISCONDUCT" | "DEMERIT" | "MINOR_FAULT" | "MAJOR_FAULT" | "LATE" | "ABSENT"

const LABEL: Record<BehaviorType, string> = {
  MERIT: "優點", MISCONDUCT: "違規", DEMERIT: "缺點",
  MINOR_FAULT: "小過", MAJOR_FAULT: "大過", LATE: "遲到", ABSENT: "缺席",
}

type Student = {
  className: string; studentName: string
  counts: Partial<Record<BehaviorType, number>>
  negative: number; severity: number; prevNegative: number; delta: number; unresolved: number
}

type Data = {
  order: BehaviorType[]
  period: { label: string; prevLabel: string }
  classes: string[]
  students: Student[]
  totals: { flagged: number; worsening: number; unresolved: number }
}

// Severity is a weighted score (大過 8 … 遲到 1), so a single 大過 outranks a
// handful of lates rather than everything being one-record-one-point.
function riskBand(s: Student): { label: string; color: string } {
  if (s.severity >= 12) return { label: "高", color: "var(--color-discipline)" }
  if (s.severity >= 5)  return { label: "中", color: "var(--color-admin)" }
  return { label: "低", color: "var(--color-ink-400)" }
}

export default function EarlyWarningPage() {
  const [data,    setData]    = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied,  setDenied]  = useState<string | null>(null)
  const [cls,     setCls]     = useState("")
  const [onlyWorse, setOnlyWorse] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const qs = cls ? `?className=${encodeURIComponent(cls)}` : ""
    const res = await fetch(`/api/discipline/early-warning${qs}`)
    if (res.status === 403) {
      setDenied((await res.json().catch(() => ({})))?.error ?? "沒有權限")
    } else if (res.ok) {
      setData(await res.json()); setDenied(null)
    }
    setLoading(false)
  }, [cls])

  useEffect(() => { load() }, [load])

  if (denied) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="card p-8 text-center text-body" style={{ color: "var(--color-ink-400)" }}>{denied}</div>
      </div>
    )
  }

  const shown = (data?.students ?? []).filter((s) => !onlyWorse || s.delta > 0)

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Link href="/teacher/committee/discipline" className="text-caption" style={{ color: "var(--color-ink-400)" }}>← 訓育</Link>
        <span style={{ color: "var(--color-ink-300)" }}>/</span>
        <h1 className="text-h1">行為預警</h1>
      </div>
      <p className="text-caption mb-5" style={{ color: "var(--color-ink-400)" }}>
        本月需要留意的學生，按嚴重程度排序（大過權重最高）。與上月比較，及早發現轉差的個案，不必等到累積至提示門檻。
      </p>

      {data && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: `${data.period.label} 需留意`, value: data.totals.flagged,    color: "var(--color-ink-900)" },
            { label: `較 ${data.period.prevLabel} 轉差`, value: data.totals.worsening,  color: "var(--color-discipline)" },
            { label: "未跟進記錄",                  value: data.totals.unresolved, color: "var(--color-admin)" },
          ].map((t) => (
            <div key={t.label} className="card p-4 text-center">
              <p className="text-h1" style={{ color: t.color }}>{t.value}</p>
              <p className="text-caption" style={{ color: "var(--color-ink-500)" }}>{t.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <select value={cls} onChange={(e) => setCls(e.target.value)}
          className="px-3 py-2 text-body rounded-input border"
          style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-ink-900)" }}>
          <option value="">全部班別</option>
          {(data?.classes ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-2 text-caption" style={{ color: "var(--color-ink-700)" }}>
          <input type="checkbox" checked={onlyWorse} onChange={(e) => setOnlyWorse(e.target.checked)} />
          只顯示較上月轉差
        </label>
        <Link href="/teacher/committee/discipline/dashboard" className="ml-auto text-caption font-medium"
          style={{ color: "var(--color-discipline)" }}>
          查看累計統計 →
        </Link>
      </div>

      {loading ? (
        <p className="text-body text-center py-12" style={{ color: "var(--color-ink-300)" }}>載入中…</p>
      ) : shown.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-h3">✅ {onlyWorse ? "本月沒有轉差的個案" : "本月暫無需要留意的學生"}</p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                <th className="text-left px-3 py-2 text-caption" style={{ color: "var(--color-ink-500)" }}>風險</th>
                <th className="text-left px-3 py-2 text-caption" style={{ color: "var(--color-ink-500)" }}>班別</th>
                <th className="text-left px-3 py-2 text-caption" style={{ color: "var(--color-ink-500)" }}>學生</th>
                {(data?.order ?? []).map((t) => (
                  <th key={t} className="px-2 py-2 text-caption text-center" style={{ color: "var(--color-ink-500)" }}>{LABEL[t]}</th>
                ))}
                <th className="px-2 py-2 text-caption text-center" style={{ color: "var(--color-ink-500)" }}>本月負面</th>
                <th className="px-2 py-2 text-caption text-center" style={{ color: "var(--color-ink-500)" }}>對比上月</th>
                <th className="px-2 py-2 text-caption text-center" style={{ color: "var(--color-ink-500)" }}>未跟進</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => {
                const band = riskBand(s)
                return (
                  <tr key={`${s.className}-${s.studentName}`} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td className="px-3 py-2">
                      <span className="text-[11px] px-2 py-0.5 rounded-pill font-medium"
                        style={{ background: band.color + "20", color: band.color }}>{band.label}</span>
                    </td>
                    <td className="px-3 py-2" style={{ color: "var(--color-ink-700)" }}>{s.className}</td>
                    <td className="px-3 py-2 font-medium" style={{ color: "var(--color-ink-900)" }}>{s.studentName}</td>
                    {(data?.order ?? []).map((t) => (
                      <td key={t} className="px-2 py-2 text-center"
                        style={{ color: (s.counts[t] ?? 0) === 0 ? "var(--color-ink-300)" : t === "MERIT" ? "var(--color-curriculum)" : "var(--color-ink-900)" }}>
                        {s.counts[t] ?? 0}
                      </td>
                    ))}
                    <td className="px-2 py-2 text-center font-medium" style={{ color: "var(--color-ink-900)" }}>{s.negative}</td>
                    <td className="px-2 py-2 text-center">
                      {s.delta > 0 ? (
                        <span style={{ color: "var(--color-discipline)" }}>▲ +{s.delta}</span>
                      ) : s.delta < 0 ? (
                        <span style={{ color: "var(--color-curriculum)" }}>▼ {s.delta}</span>
                      ) : (
                        <span style={{ color: "var(--color-ink-300)" }}>—</span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-center"
                      style={{ color: s.unresolved > 0 ? "var(--color-admin)" : "var(--color-ink-300)" }}>
                      {s.unresolved}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
