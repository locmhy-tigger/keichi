"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

type Activity = {
  id:          string
  title:       string
  description: string | null
  startTime:   string
  endTime:     string | null
  location:    string | null
  committee:   string | null
  _count:      { assignments: number }
  assignments: { id: string }[]
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`
}

export default function TeacherActivitiesPage() {
  const [activities, setActivities]   = useState<Activity[]>([])
  const [loading,    setLoading]      = useState(true)
  const [showForm,   setShowForm]     = useState(false)
  const [saving,     setSaving]       = useState(false)

  // Form state
  const [title,   setTitle]   = useState("")
  const [desc,    setDesc]    = useState("")
  const [start,   setStart]   = useState("")
  const [end,     setEnd]     = useState("")
  const [location, setLocation] = useState("")
  const [studentList, setStudentList] = useState("")

  async function load() {
    setLoading(true)
    const res = await fetch("/api/activities")
    if (res.ok) setActivities(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch("/api/activities", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        description: desc || undefined,
        startTime:   new Date(start).toISOString(),
        endTime:     end ? new Date(end).toISOString() : undefined,
        location:    location || undefined,
        studentList: studentList || undefined,
      }),
    })
    if (res.ok) {
      const created: Activity = await res.json()
      setActivities((prev) => [created, ...prev])
      setTitle(""); setDesc(""); setStart(""); setEnd(""); setLocation(""); setStudentList("")
      setShowForm(false)
    }
    setSaving(false)
  }

  const inputCls   = "w-full px-3 py-2 text-body rounded-input border outline-none"
  const inputStyle = { border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-ink-900)" }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-h1">活動管理</h1>
          <p className="text-body mt-0.5" style={{ color: "var(--color-ink-500)" }}>為學生指派活動及管理出席</p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 rounded-input text-body font-medium text-white"
          style={{ background: "var(--color-accent)" }}
        >
          + 新增活動
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="card p-5 mb-6 space-y-4">
          <h3 className="text-h3">新增活動</h3>
          <div>
            <label className="text-caption block mb-1" style={{ color: "var(--color-ink-700)" }}>活動名稱 *</label>
            <input required value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="活動名稱" className={inputCls} style={inputStyle} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-caption block mb-1" style={{ color: "var(--color-ink-700)" }}>開始時間 *</label>
              <input required type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)}
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="text-caption block mb-1" style={{ color: "var(--color-ink-700)" }}>結束時間（選填）</label>
              <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)}
                className={inputCls} style={inputStyle} />
            </div>
          </div>
          <div>
            <label className="text-caption block mb-1" style={{ color: "var(--color-ink-700)" }}>地點（選填）</label>
            <input value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder="課室、禮堂…" className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="text-caption block mb-1" style={{ color: "var(--color-ink-700)" }}>備注（選填）</label>
            <textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)}
              className={`${inputCls} resize-none`} style={inputStyle} />
          </div>
          <div>
            <label className="text-caption block mb-1 font-medium" style={{ color: "var(--color-ink-700)" }}>學生名單 (選填)</label>
            <textarea rows={4} value={studentList} onChange={(e) => setStudentList(e.target.value)}
              placeholder="可從 Excel 貼上姓名或 Email (每行一個)"
              className={`${inputCls} resize-none font-mono text-[11px]`} style={inputStyle} />
            <p className="text-[10px] text-gray-400 mt-1">系統將自動匹配學生並檢查時間衝突</p>
          </div>
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 text-body rounded-input border"
              style={{ border: "1px solid var(--color-border)", color: "var(--color-ink-700)" }}>
              取消
            </button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-body font-medium rounded-input text-white"
              style={{ background: "var(--color-accent)", opacity: saving ? 0.7 : 1 }}>
              {saving ? "儲存中…" : "建立活動"}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-12 text-body" style={{ color: "var(--color-ink-300)" }}>載入中…</div>
      ) : activities.length === 0 ? (
        <div className="text-center py-12 text-body" style={{ color: "var(--color-ink-300)" }}>尚未建立任何活動</div>
      ) : (
        <div className="space-y-3">
          {activities.map((act) => (
            <Link
              key={act.id}
              href={`/teacher/activities/${act.id}`}
              className="card p-5 block hover:shadow-card-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-h3 mb-1">{act.title}</h3>
                  <div className="flex items-center gap-4 flex-wrap">
                    <p className="text-caption" style={{ color: "var(--color-ink-500)" }}>
                      📅 {formatDateTime(act.startTime)}
                      {act.endTime && ` — ${formatDateTime(act.endTime)}`}
                    </p>
                    {act.location && (
                      <p className="text-caption" style={{ color: "var(--color-ink-500)" }}>
                        📍 {act.location}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-caption font-medium" style={{ color: "var(--color-accent)" }}>
                    {act._count.assignments} 名學生
                  </p>
                  <p className="text-caption" style={{ color: "var(--color-ink-400)" }}>
                    {act.assignments.length} 已確認
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
