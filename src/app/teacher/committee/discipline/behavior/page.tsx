"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

type BehaviorType = "MISCONDUCT" | "MERIT"

type BehaviorRecord = {
  id:          string
  date:        string
  className:   string
  studentName: string
  type:        BehaviorType
  description: string
  action:      string | null
  resolved:    boolean
  authorId:    string
  createdAt:   string
  author:      { id: string; name: string | null }
}

type Filter = "ALL" | "UNRESOLVED" | "RESOLVED"
type TypeFilter = "ALL" | "MISCONDUCT" | "MERIT"

const TYPE_LABEL: Record<BehaviorType, string> = { MISCONDUCT: "違規", MERIT: "良好表現" }

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日`
}

export default function BehaviorPage() {
  const [records,      setRecords]      = useState<BehaviorRecord[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showForm,     setShowForm]     = useState(false)
  const [filter,       setFilter]       = useState<Filter>("ALL")
  const [typeFilter,   setTypeFilter]   = useState<TypeFilter>("ALL")
  const [classFilter,  setClassFilter]  = useState("")
  const [saving,       setSaving]       = useState(false)

  // Form state
  const [date,         setDate]         = useState(new Date().toISOString().slice(0, 10))
  const [className,    setClassName]    = useState("")
  const [studentName,  setStudentName]  = useState("")
  const [type,         setType]         = useState<BehaviorType>("MISCONDUCT")
  const [description,  setDescription]  = useState("")
  const [action,       setAction]       = useState("")

  async function load() {
    setLoading(true)
    const params = new URLSearchParams()
    if (filter === "UNRESOLVED") params.set("resolved", "false")
    if (filter === "RESOLVED")   params.set("resolved", "true")
    if (typeFilter !== "ALL")    params.set("type", typeFilter)
    if (classFilter)             params.set("className", classFilter)
    const res = await fetch(`/api/behavior-records?${params}`)
    if (res.ok) setRecords(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [filter, typeFilter, classFilter]) // eslint-disable-line

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch("/api/behavior-records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, className, studentName, type, description, action: action || undefined }),
    })
    if (res.ok) {
      const created: BehaviorRecord = await res.json()
      setRecords((prev) => [created, ...prev])
      setDescription(""); setAction(""); setShowForm(false)
    }
    setSaving(false)
  }

  async function toggleResolved(record: BehaviorRecord) {
    const res = await fetch(`/api/behavior-records/${record.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolved: !record.resolved }),
    })
    if (res.ok) {
      const updated: BehaviorRecord = await res.json()
      setRecords((prev) => prev.map((r) => r.id === updated.id ? updated : r))
    }
  }

  async function deleteRecord(id: string) {
    setRecords((prev) => prev.filter((r) => r.id !== id))
    await fetch(`/api/behavior-records/${id}`, { method: "DELETE" })
  }

  const inputCls   = "w-full px-3 py-2 text-body rounded-input border outline-none"
  const inputStyle = { border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-ink-900)" }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-4 flex items-center gap-3">
        <Link href="/teacher/committee/discipline" className="text-caption" style={{ color: "var(--color-ink-400)" }}>
          ← 訓育
        </Link>
        <span style={{ color: "var(--color-ink-300)" }}>/</span>
        <h1 className="text-h1">行為記錄</h1>
        <a
          href="/api/behavior-records/export"
          className="ml-auto text-caption px-3 py-2 rounded-input border"
          style={{ border: "1px solid var(--color-border)", color: "var(--color-ink-500)" }}
        >
          ⬇ 匯出 CSV
        </a>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="px-4 py-2 rounded-input text-body font-medium text-white"
          style={{ background: "var(--color-accent)" }}
        >
          + 新增記錄
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={create} className="card p-5 mb-6 space-y-4">
          <h3 className="text-h3">新增行為記錄</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-caption block mb-1" style={{ color: "var(--color-ink-700)" }}>日期 *</label>
              <input type="date" required value={date} onChange={(e) => setDate(e.target.value)}
                className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="text-caption block mb-1" style={{ color: "var(--color-ink-700)" }}>類型 *</label>
              <select required value={type} onChange={(e) => setType(e.target.value as BehaviorType)}
                className={inputCls} style={inputStyle}>
                <option value="MISCONDUCT">違規</option>
                <option value="MERIT">良好表現</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-caption block mb-1" style={{ color: "var(--color-ink-700)" }}>班別 *</label>
              <input required value={className} onChange={(e) => setClassName(e.target.value)}
                placeholder="如：4A" className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="text-caption block mb-1" style={{ color: "var(--color-ink-700)" }}>學生姓名 *</label>
              <input required value={studentName} onChange={(e) => setStudentName(e.target.value)}
                placeholder="學生全名" className={inputCls} style={inputStyle} />
            </div>
          </div>

          <div>
            <label className="text-caption block mb-1" style={{ color: "var(--color-ink-700)" }}>事件描述 *</label>
            <textarea required rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="詳細描述事件經過" className={`${inputCls} resize-none`} style={inputStyle} />
          </div>

          <div>
            <label className="text-caption block mb-1" style={{ color: "var(--color-ink-700)" }}>跟進行動（選填）</label>
            <textarea rows={2} value={action} onChange={(e) => setAction(e.target.value)}
              placeholder="已採取的跟進措施" className={`${inputCls} resize-none`} style={inputStyle} />
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
              {saving ? "儲存中…" : "儲存"}
            </button>
          </div>
        </form>
      )}

      {/* Filters */}
      <div className="space-y-3 mb-4">
        <div className="flex gap-2 flex-wrap">
          {(["ALL", "UNRESOLVED", "RESOLVED"] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-pill text-caption font-medium border transition-colors"
              style={{
                background: filter === f ? "var(--color-ink-900)" : "var(--color-surface)",
                color:      filter === f ? "white" : "var(--color-ink-700)",
                border:     "1px solid var(--color-border)",
              }}>
              {f === "ALL" ? "全部" : f === "UNRESOLVED" ? "未處理" : "已處理"}
            </button>
          ))}
          {(["ALL", "MISCONDUCT", "MERIT"] as TypeFilter[]).map((f) => (
            <button key={f} onClick={() => setTypeFilter(f)}
              className="px-3 py-1.5 rounded-pill text-caption font-medium border transition-colors"
              style={{
                background: typeFilter === f
                  ? f === "MISCONDUCT" ? "var(--color-discipline)" : f === "MERIT" ? "var(--color-curriculum)" : "var(--color-accent)"
                  : "var(--color-surface)",
                color:      typeFilter === f ? "white" : "var(--color-ink-700)",
                border:     "1px solid var(--color-border)",
              }}>
              {f === "ALL" ? "全部類型" : TYPE_LABEL[f as BehaviorType]}
            </button>
          ))}
        </div>
        <input
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          placeholder="篩選班別…"
          className="px-3 py-2 text-body rounded-input border outline-none w-40"
          style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-ink-900)" }}
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-body" style={{ color: "var(--color-ink-300)" }}>載入中…</div>
      ) : records.length === 0 ? (
        <div className="text-center py-12 text-body" style={{ color: "var(--color-ink-300)" }}>暫無記錄</div>
      ) : (
        <ul className="space-y-2">
          {records.map((record) => (
            <li
              key={record.id}
              className={`card pl-4 pr-4 py-3 ${record.type === "MISCONDUCT" ? "committee-border-discipline" : "committee-border-curriculum"}`}
              style={{ opacity: record.resolved ? 0.65 : 1 }}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span
                      className="text-caption px-2 py-0.5 rounded-pill font-medium"
                      style={{
                        background: record.type === "MISCONDUCT" ? "var(--color-discipline-soft)" : "var(--color-curriculum-soft)",
                        color:      record.type === "MISCONDUCT" ? "var(--color-discipline)"      : "var(--color-curriculum)",
                      }}
                    >
                      {TYPE_LABEL[record.type]}
                    </span>
                    <span className="text-body font-medium" style={{ color: "var(--color-ink-900)" }}>
                      {record.className} · {record.studentName}
                    </span>
                    <span className="text-caption" style={{ color: "var(--color-ink-400)" }}>
                      {formatDate(record.date)}
                    </span>
                    {record.resolved && (
                      <span className="text-caption px-2 py-0.5 rounded-pill"
                        style={{ background: "var(--color-surface-2)", color: "var(--color-ink-400)" }}>
                        已處理
                      </span>
                    )}
                  </div>
                  <p className="text-caption" style={{ color: "var(--color-ink-700)" }}>{record.description}</p>
                  {record.action && (
                    <p className="text-caption mt-0.5" style={{ color: "var(--color-ink-500)" }}>跟進：{record.action}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleResolved(record)}
                    className="text-caption px-2.5 py-1 rounded-input border"
                    style={{ border: "1px solid var(--color-border)", color: "var(--color-ink-700)" }}
                  >
                    {record.resolved ? "重開" : "已處理"}
                  </button>
                  <button
                    onClick={() => deleteRecord(record.id)}
                    className="text-caption px-2 py-1 rounded-input"
                    style={{ color: "var(--color-ink-300)" }}
                    title="刪除"
                  >×</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
