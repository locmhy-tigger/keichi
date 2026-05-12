"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"

type AttendanceStatus = "PENDING" | "CONFIRMED" | "ATTENDED" | "ABSENT"

type Student = { id: string; name: string | null; email: string | null; image: string | null }

type Assignment = {
  activityId: string
  studentId:  string
  status:     AttendanceStatus
  alertSent:  boolean
  note:       string | null
  student:    Student
}

type Activity = {
  id:          string
  title:       string
  description: string | null
  startTime:   string
  endTime:     string | null
  location:    string | null
  assignments: Assignment[]
}

type Clash = {
  studentId:   string
  studentName: string | null
  activity:    { id: string; title: string; startTime: string }
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PENDING:   "待確認",
  CONFIRMED: "已確認",
  ATTENDED:  "出席",
  ABSENT:    "缺席",
}

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  PENDING:   "var(--color-ink-400)",
  CONFIRMED: "var(--color-accent)",
  ATTENDED:  "var(--color-curriculum)",
  ABSENT:    "var(--color-discipline)",
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`
}

function StudentSearch({ onAssign, existingIds }: {
  onAssign: (assigned: { studentId: string }[], clashes: Clash[]) => void
  existingIds: Set<string>
}) {
  const [query,   setQuery]   = useState("")
  const [results, setResults] = useState<Student[]>([])
  const [selected, setSelected] = useState<Student[]>([])
  const [assigning, setAssigning] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    const url = q ? `/api/users?q=${encodeURIComponent(q)}` : "/api/users"
    const res  = await fetch(url)
    if (res.ok) {
      const data: (Student & { role: string })[] = await res.json()
      // Show all users (teachers visible for now; in production filter by role=STUDENT)
      setResults(data.filter((u) => !existingIds.has(u.id) && !selected.some((s) => s.id === u.id)))
    }
  }, [existingIds, selected])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(query), 300)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, search])

  const inputStyle = { border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-ink-900)" }

  return (
    <div className="space-y-3">
      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((s) => (
            <span key={s.id} className="flex items-center gap-1 px-2 py-0.5 rounded-pill text-caption"
              style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}>
              {s.name ?? s.email}
              <button type="button" onClick={() => setSelected((prev) => prev.filter((x) => x.id !== s.id))}>×</button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋學生姓名…"
            className="w-full px-3 py-2 text-body rounded-input border outline-none text-caption"
            style={inputStyle}
          />
          {results.length > 0 && (
            <div className="absolute z-10 w-full mt-1 rounded-input shadow-card overflow-hidden"
              style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}>
              {results.slice(0, 8).map((u) => (
                <button key={u.id} type="button"
                  onClick={() => { setSelected((prev) => [...prev, u]); setQuery(""); setResults([]) }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--color-surface-2)] transition-colors">
                  <span className="text-body" style={{ color: "var(--color-ink-900)" }}>{u.name ?? u.email}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          disabled={selected.length === 0 || assigning}
          onClick={async () => {
            if (selected.length === 0) return
            setAssigning(true)
            const actId = window.location.pathname.split("/").pop()
            const res = await fetch(`/api/activities/${actId}/assign`, {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body:    JSON.stringify({ studentIds: selected.map((s) => s.id) }),
            })
            if (res.ok) {
              const { assigned, clashes } = await res.json()
              onAssign(assigned, clashes)
              setSelected([])
            }
            setAssigning(false)
          }}
          className="px-4 py-2 text-body rounded-input text-white shrink-0"
          style={{ background: "var(--color-accent)", opacity: selected.length === 0 ? 0.5 : 1 }}
        >
          {assigning ? "指派中…" : "指派"}
        </button>
      </div>
    </div>
  )
}

function BulkAssignModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: (count: number, clashes: Clash[]) => void }) {
  const [list, setList] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!list.trim() || busy) return
    setBusy(true)
    const actId = window.location.pathname.split("/").pop()
    const res = await fetch(`/api/activities/${actId}/assign`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ studentList: list }),
    })
    if (res.ok) {
      const data = await res.json()
      onSuccess(data.assignedCount, data.clashes)
    }
    setBusy(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <form onSubmit={submit} className="p-6 space-y-4">
          <h3 className="text-h3">批量指派學生</h3>
          <p className="text-caption" style={{ color: "var(--color-ink-500)" }}>
            請貼上從 Excel 複製的學生姓名或 Email 列表（每行一個）。
          </p>
          <textarea
            required
            rows={8}
            value={list}
            onChange={(e) => setList(e.target.value)}
            className="w-full px-3 py-2 text-caption rounded-input border outline-none font-mono"
            style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-ink-900)" }}
            placeholder="陳大文&#10;lee.siu.ming@school.hk&#10;..."
          />
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-input border text-body">取消</button>
            <button type="submit" disabled={busy || !list.trim()} 
              className="flex-1 py-2 rounded-input bg-blue-600 text-white text-body font-medium disabled:opacity-50"
              style={{ background: "var(--color-accent)" }}>
              {busy ? "處理中…" : "確認指派"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [activity,  setActivity]  = useState<Activity | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [clashes,   setClashes]   = useState<Clash[]>([])
  const [alerting,  setAlerting]  = useState(false)
  const [alertDone, setAlertDone] = useState(false)
  const [showBulk,  setShowBulk]  = useState(false)

  async function load() {
    const res = await fetch(`/api/activities/${id}`)
    if (res.ok) setActivity(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [id]) // eslint-disable-line

  async function updateStatus(studentId: string, status: AttendanceStatus) {
    const res = await fetch(`/api/activities/${id}/assignments/${studentId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ status }),
    })
    if (res.ok) {
      const updated: Assignment = await res.json()
      setActivity((prev) => prev ? {
        ...prev,
        assignments: prev.assignments.map((a) => a.studentId === studentId ? { ...a, ...updated } : a),
      } : prev)
    }
  }

  async function sendAlert() {
    setAlerting(true)
    await fetch(`/api/activities/${id}/alert`, { method: "POST" })
    setAlerting(false)
    setAlertDone(true)
  }

  function handleAssign(assigned: any, newClashes: Clash[]) {
    setClashes(newClashes)
    load()
    setShowBulk(false)
  }

  if (loading) return <div className="p-6 text-center text-body" style={{ color: "var(--color-ink-300)" }}>載入中…</div>
  if (!activity) return <div className="p-6 text-center text-body" style={{ color: "var(--color-ink-300)" }}>找不到活動</div>

  const existingIds = new Set(activity.assignments.map((a) => a.studentId))

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link href="/teacher/activities" className="text-caption mb-2 inline-block"
          style={{ color: "var(--color-ink-400)" }}>← 活動管理</Link>
        <h1 className="text-h1">{activity.title}</h1>
        <div className="flex gap-4 mt-1 flex-wrap">
          <p className="text-body" style={{ color: "var(--color-ink-500)" }}>
            📅 {formatDateTime(activity.startTime)}
            {activity.endTime && ` — ${formatDateTime(activity.endTime)}`}
          </p>
          {activity.location && (
            <p className="text-body" style={{ color: "var(--color-ink-500)" }}>📍 {activity.location}</p>
          )}
        </div>
        {activity.description && (
          <p className="text-body mt-2" style={{ color: "var(--color-ink-700)" }}>{activity.description}</p>
        )}
      </div>

      {/* Clash warnings */}
      {clashes.length > 0 && (
        <div className="card p-4 space-y-2" style={{ borderLeft: "4px solid var(--color-admin)" }}>
          <p className="text-body font-medium" style={{ color: "var(--color-admin)" }}>
            ⚠ {clashes.length} 名學生時間衝突，已設為待確認：
          </p>
          {clashes.map((c, i) => (
            <p key={i} className="text-caption" style={{ color: "var(--color-ink-700)" }}>
              {c.studentName} — 與「{c.activity.title}」衝突
            </p>
          ))}
          <button onClick={() => setClashes([])} className="text-caption" style={{ color: "var(--color-ink-400)" }}>關閉</button>
        </div>
      )}

      {/* Student assignment */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-h2">指派學生</h2>
          <button 
            onClick={() => setShowBulk(true)}
            className="text-caption px-3 py-1.5 rounded-input border"
            style={{ border: "1px solid var(--color-border)", color: "var(--color-accent)" }}
          >
            批量指派 (Excel)
          </button>
        </div>
        <StudentSearch onAssign={handleAssign} existingIds={existingIds} />
      </div>

      {/* Student attendance list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-h2">出席名單 ({activity.assignments.length})</h2>
          <button
            onClick={sendAlert}
            disabled={alerting || alertDone}
            className="text-caption px-3 py-1.5 rounded-input text-white"
            style={{ background: alertDone ? "var(--color-curriculum)" : "var(--color-accent)", opacity: alerting ? 0.7 : 1 }}
          >
            {alertDone ? "✓ 提醒已發送" : alerting ? "發送中…" : "發送提醒"}
          </button>
        </div>

        {activity.assignments.length === 0 ? (
          <div className="card p-6 text-center text-body" style={{ color: "var(--color-ink-300)" }}>
            尚未指派學生
          </div>
        ) : (
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-border)" }}>
                  <th className="text-left px-4 py-3 text-caption" style={{ color: "var(--color-ink-500)" }}>學生</th>
                  <th className="text-left px-4 py-3 text-caption" style={{ color: "var(--color-ink-500)" }}>狀態</th>
                  <th className="text-left px-4 py-3 text-caption" style={{ color: "var(--color-ink-500)" }}>備註</th>
                  <th className="px-4 py-3 text-caption" style={{ color: "var(--color-ink-500)" }}>更新</th>
                </tr>
              </thead>
              <tbody>
                {activity.assignments.map((a) => (
                  <tr key={a.studentId} style={{ borderBottom: "1px solid var(--color-border)" }}>
                    <td className="px-4 py-3">
                      <p className="text-body font-medium" style={{ color: "var(--color-ink-900)" }}>
                        {a.student.name ?? "—"}
                      </p>
                      <p className="text-caption" style={{ color: "var(--color-ink-400)" }}>{a.student.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-caption font-medium px-2 py-0.5 rounded-pill"
                        style={{ background: STATUS_COLORS[a.status] + "20", color: STATUS_COLORS[a.status] }}>
                        {STATUS_LABELS[a.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-caption" style={{ color: a.status === "PENDING" ? "var(--color-discipline)" : "var(--color-ink-400)" }}>
                        {a.note ?? "—"}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={a.status}
                        onChange={(e) => updateStatus(a.studentId, e.target.value as AttendanceStatus)}
                        className="text-caption px-2 py-1 rounded-input border outline-none"
                        style={{ border: "1px solid var(--color-border)", color: "var(--color-ink-700)" }}
                      >
                        {(["PENDING", "CONFIRMED", "ATTENDED", "ABSENT"] as AttendanceStatus[]).map((s) => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {showBulk && (
        <BulkAssignModal 
          onClose={() => setShowBulk(false)} 
          onSuccess={handleAssign} 
        />
      )}
    </div>
  )
}
