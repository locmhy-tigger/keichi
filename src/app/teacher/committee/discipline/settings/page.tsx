"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { BEHAVIOR_LABEL, type BehaviorTypeValue } from "@/lib/behavior-types"

type Homeroom = { className: string; teacherName: string; teacherEmail: string; teacherUserId: string | null }
type Threshold = { category: BehaviorTypeValue; threshold: number; enabled: boolean }

export default function DisciplineSettingsPage() {
  const [tab, setTab] = useState<"homeroom" | "thresholds">("homeroom")

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Link href="/teacher/committee/discipline" className="text-caption" style={{ color: "var(--color-ink-400)" }}>← 訓育</Link>
        <span style={{ color: "var(--color-ink-300)" }}>/</span>
        <h1 className="text-h1">訓育設定</h1>
      </div>
      <p className="text-caption mb-6" style={{ color: "var(--color-ink-400)" }}>
        設定各班班主任電郵，及自動提示門檻。
      </p>

      <div className="flex gap-1 mb-6 border-b" style={{ borderColor: "var(--color-border)" }}>
        {([{ k: "homeroom", l: "班主任" }, { k: "thresholds", l: "提示門檻" }] as const).map((t) => (
          <button key={t.k} onClick={() => setTab(t.k)}
            className="px-4 py-2 text-body -mb-px"
            style={{
              color:        tab === t.k ? "var(--color-accent)" : "var(--color-ink-500)",
              borderBottom: tab === t.k ? "2px solid var(--color-accent)" : "2px solid transparent",
              fontWeight:   tab === t.k ? 600 : 400,
            }}>{t.l}</button>
        ))}
      </div>

      {tab === "homeroom" ? <HomeroomTab /> : <ThresholdsTab />}
    </div>
  )
}

function HomeroomTab() {
  const [assignments, setAssignments] = useState<Homeroom[]>([])
  const [unassigned,  setUnassigned]  = useState<string[]>([])
  const [loading,     setLoading]     = useState(true)
  const [editing,     setEditing]     = useState<string | null>(null)
  const [form,        setForm]        = useState<Homeroom>({ className: "", teacherName: "", teacherEmail: "", teacherUserId: null })
  const [saving,      setSaving]      = useState(false)

  function load() {
    setLoading(true)
    fetch("/api/discipline/homeroom")
      .then((r) => r.ok ? r.json() : { assignments: [], unassigned: [] })
      .then((d) => { setAssignments(d.assignments ?? []); setUnassigned(d.unassigned ?? []) })
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  function edit(h: Homeroom) { setEditing(h.className); setForm(h) }
  function addFor(className: string) { setEditing(className); setForm({ className, teacherName: "", teacherEmail: "", teacherUserId: null }) }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch("/api/discipline/homeroom", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) { setEditing(null); load() }
  }

  async function remove(className: string) {
    await fetch("/api/discipline/homeroom", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ className }),
    })
    load()
  }

  const inputCls   = "w-full px-3 py-2 text-body rounded-input border outline-none"
  const inputStyle = { border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-ink-900)" }

  if (loading) return <p className="text-body text-center py-12" style={{ color: "var(--color-ink-300)" }}>載入中…</p>

  return (
    <div className="space-y-6">
      {/* Edit form */}
      {editing !== null && (
        <form onSubmit={save} className="card p-5 space-y-3">
          <h3 className="text-h3">{form.className ? `班主任 — ${form.className}` : "新增班主任"}</h3>
          {!assignments.find((a) => a.className === editing) && !form.className && (
            <input required placeholder="班別（如 1A）" value={form.className}
              onChange={(e) => setForm({ ...form, className: e.target.value })} className={inputCls} style={inputStyle} />
          )}
          <div className="grid grid-cols-2 gap-3">
            <input required placeholder="班主任姓名" value={form.teacherName}
              onChange={(e) => setForm({ ...form, teacherName: e.target.value })} className={inputCls} style={inputStyle} />
            <input required type="email" placeholder="班主任電郵" value={form.teacherEmail}
              onChange={(e) => setForm({ ...form, teacherEmail: e.target.value })} className={inputCls} style={inputStyle} />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setEditing(null)} className="px-4 py-2 text-body rounded-input border"
              style={{ border: "1px solid var(--color-border)", color: "var(--color-ink-700)" }}>取消</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-body font-medium rounded-input text-white"
              style={{ background: "var(--color-accent)", opacity: saving ? 0.7 : 1 }}>{saving ? "儲存中…" : "儲存"}</button>
          </div>
        </form>
      )}

      {/* Unassigned classes (from records) */}
      {unassigned.length > 0 && (
        <div>
          <p className="text-caption mb-2" style={{ color: "var(--color-ink-400)" }}>未設定班主任的班別（來自行為紀錄）</p>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((c) => (
              <button key={c} onClick={() => addFor(c)}
                className="text-caption px-3 py-1.5 rounded-input border border-dashed"
                style={{ borderColor: "var(--color-border)", color: "var(--color-ink-500)" }}>
                + {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Assignments */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-caption" style={{ color: "var(--color-ink-400)" }}>已設定班主任</p>
          <button onClick={() => addFor("")} className="text-caption px-3 py-1.5 rounded-input text-white"
            style={{ background: "var(--color-accent)" }}>+ 新增</button>
        </div>
        {assignments.length === 0 ? (
          <div className="card p-6 text-center text-caption" style={{ color: "var(--color-ink-300)" }}>尚未設定任何班主任</div>
        ) : (
          <div className="space-y-2">
            {assignments.map((h) => (
              <div key={h.className} className="card p-3 flex items-center gap-3">
                <span className="text-body font-medium w-16 shrink-0" style={{ color: "var(--color-ink-900)" }}>{h.className}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-caption" style={{ color: "var(--color-ink-700)" }}>{h.teacherName}</p>
                  <p className="text-[11px] truncate" style={{ color: "var(--color-ink-400)" }}>{h.teacherEmail}</p>
                </div>
                <button onClick={() => edit(h)} className="text-caption px-2 py-1 rounded-input border shrink-0"
                  style={{ border: "1px solid var(--color-border)", color: "var(--color-ink-700)" }}>編輯</button>
                <button onClick={() => remove(h.className)} className="text-caption px-1.5 py-1 rounded-input shrink-0"
                  style={{ color: "var(--color-ink-300)" }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ThresholdsTab() {
  const [rows,    setRows]    = useState<Threshold[]>([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

  useEffect(() => {
    fetch("/api/discipline/thresholds")
      .then((r) => r.ok ? r.json() : { thresholds: [] })
      .then((d) => setRows(d.thresholds ?? []))
      .finally(() => setLoading(false))
  }, [])

  function update(i: number, patch: Partial<Threshold>) {
    setRows((prev) => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  }

  async function save() {
    setSaving(true)
    const res = await fetch("/api/discipline/thresholds", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ thresholds: rows }),
    })
    setSaving(false)
    if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500) }
  }

  if (loading) return <p className="text-body text-center py-12" style={{ color: "var(--color-ink-300)" }}>載入中…</p>

  return (
    <div>
      <p className="text-caption mb-4" style={{ color: "var(--color-ink-400)" }}>
        當學生某類別紀錄達到門檻，系統會自動電郵該班班主任（每次跨越門檻只發送一次）。
      </p>
      <div className="card divide-y" style={{ borderColor: "var(--color-border)" }}>
        {rows.map((r, i) => (
          <div key={r.category} className="flex items-center gap-3 p-3" style={{ borderColor: "var(--color-border)" }}>
            <label className="flex items-center gap-2 cursor-pointer w-24 shrink-0">
              <input type="checkbox" checked={r.enabled} onChange={(e) => update(i, { enabled: e.target.checked })} />
              <span className="text-body font-medium" style={{ color: "var(--color-ink-900)" }}>{BEHAVIOR_LABEL[r.category]}</span>
            </label>
            <div className="flex items-center gap-2 flex-1">
              <span className="text-caption" style={{ color: "var(--color-ink-400)" }}>達到</span>
              <input type="number" min={1} max={100} value={r.threshold} disabled={!r.enabled}
                onChange={(e) => update(i, { threshold: Number(e.target.value) })}
                className="w-20 px-2 py-1 text-body rounded-input border outline-none text-center"
                style={{ border: "1px solid var(--color-border)", background: r.enabled ? "var(--color-surface)" : "var(--color-surface-2)", color: "var(--color-ink-900)" }} />
              <span className="text-caption" style={{ color: "var(--color-ink-400)" }}>次時通知班主任</span>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-4">
        <button onClick={save} disabled={saving} className="px-4 py-2 text-body font-medium rounded-input text-white"
          style={{ background: "var(--color-accent)", opacity: saving ? 0.7 : 1 }}>
          {saving ? "儲存中…" : "儲存設定"}
        </button>
        {saved && <span className="text-caption" style={{ color: "var(--color-curriculum)" }}>✓ 已儲存</span>}
      </div>
    </div>
  )
}
