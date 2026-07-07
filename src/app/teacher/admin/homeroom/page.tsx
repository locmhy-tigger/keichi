"use client"

import { useEffect, useState, useRef } from "react"
import Link from "next/link"

type Student = { id: string; studentName: string; classNumber: string | null }
type HClass = {
  id: string; className: string; teacherName: string; teacherEmail: string
  students: Student[]; _count: { students: number }
}

export default function AdminHomeroomPage() {
  const [classes, setClasses] = useState<HClass[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing,  setEditing]  = useState<HClass | null>(null)
  const [saving,   setSaving]   = useState(false)

  // Class form
  const [className,    setClassName]    = useState("")
  const [teacherName,  setTeacherName]  = useState("")
  const [teacherEmail, setTeacherEmail] = useState("")

  // Roster add
  const [newStudent, setNewStudent] = useState("")
  const [newNumber,  setNewNumber]  = useState("")
  const fileRef = useRef<HTMLInputElement>(null)
  const [msg, setMsg] = useState<string | null>(null)

  function load() {
    setLoading(true)
    fetch("/api/admin/homeroom")
      .then((r) => r.ok ? r.json() : { classes: [] })
      .then((d) => setClasses(d.classes ?? []))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  function openAdd() { setEditing(null); setClassName(""); setTeacherName(""); setTeacherEmail(""); setShowForm(true) }
  function openEdit(c: HClass) { setEditing(c); setClassName(c.className); setTeacherName(c.teacherName); setTeacherEmail(c.teacherEmail); setShowForm(true) }

  async function saveClass(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await fetch("/api/admin/homeroom", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ className, teacherName, teacherEmail }),
    })
    setSaving(false)
    if (res.ok) { setShowForm(false); load() }
  }

  async function deleteClass(className: string) {
    await fetch("/api/admin/homeroom", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ className }),
    })
    load()
  }

  async function addStudent(className: string) {
    if (!newStudent.trim()) return
    const res = await fetch("/api/admin/homeroom/roster", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ className, students: [{ studentName: newStudent.trim(), classNumber: newNumber.trim() || undefined }] }),
    })
    if (res.ok) { setNewStudent(""); setNewNumber(""); load() }
  }

  async function removeStudent(className: string, studentName: string) {
    await fetch("/api/admin/homeroom/roster", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ className, studentName }),
    })
    load()
  }

  async function importRoster(className: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    // Each line: 姓名 or 姓名,學號  (a header line "姓名..." is skipped)
    const students = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
      .filter((l, i) => !(i === 0 && /姓名|name/i.test(l)))
      .map((l) => { const [studentName, classNumber] = l.split(","); return { studentName: studentName.trim(), classNumber: classNumber?.trim() || undefined } })
      .filter((s) => s.studentName)
    if (fileRef.current) fileRef.current.value = ""
    if (students.length === 0) { setMsg("檔案沒有有效學生"); return }
    const res = await fetch("/api/admin/homeroom/roster", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ className, students: students.slice(0, 100) }),
    })
    setMsg(res.ok ? `✓ 已匯入 ${students.length} 名學生到 ${className}` : "匯入失敗")
    setTimeout(() => setMsg(null), 4000)
    if (res.ok) load()
  }

  const inputCls   = "w-full px-3 py-2 text-body rounded-input border outline-none"
  const inputStyle = { border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-ink-900)" }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Link href="/teacher" className="text-caption" style={{ color: "var(--color-ink-400)" }}>← 老師主頁</Link>
        <span style={{ color: "var(--color-ink-300)" }}>/</span>
        <h1 className="text-h1">班級管理</h1>
        <button onClick={openAdd} className="ml-auto px-4 py-2 rounded-input text-body font-medium text-white"
          style={{ background: "var(--color-accent)" }}>+ 新增班別</button>
      </div>
      <p className="text-caption mb-6" style={{ color: "var(--color-ink-400)" }}>
        設定各班的班主任、電郵及學生名單。行為紀錄會由此讀取班別與學生。
      </p>

      {msg && <div className="mb-4 p-2.5 rounded-input text-caption" style={{ background: "var(--color-surface-2)", color: "var(--color-ink-700)" }}>{msg}</div>}

      {showForm && (
        <form onSubmit={saveClass} className="card p-5 mb-6 space-y-3">
          <h3 className="text-h3">{editing ? `編輯班別 — ${editing.className}` : "新增班別"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input required placeholder="班別（如 1A）" value={className} onChange={(e) => setClassName(e.target.value)}
              className={inputCls} style={inputStyle} disabled={!!editing} />
            <input required placeholder="班主任姓名" value={teacherName} onChange={(e) => setTeacherName(e.target.value)}
              className={inputCls} style={inputStyle} />
            <input required type="email" placeholder="班主任電郵" value={teacherEmail} onChange={(e) => setTeacherEmail(e.target.value)}
              className={inputCls} style={inputStyle} />
          </div>
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-body rounded-input border"
              style={{ border: "1px solid var(--color-border)", color: "var(--color-ink-700)" }}>取消</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-body font-medium rounded-input text-white"
              style={{ background: "var(--color-accent)", opacity: saving ? 0.7 : 1 }}>{saving ? "儲存中…" : "儲存"}</button>
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-body text-center py-12" style={{ color: "var(--color-ink-300)" }}>載入中…</p>
      ) : classes.length === 0 ? (
        <div className="card p-8 text-center" style={{ color: "var(--color-ink-300)" }}><p className="text-body">尚未建立任何班別</p></div>
      ) : (
        <div className="space-y-2">
          {classes.map((c) => (
            <div key={c.id} className="card p-4">
              <div className="flex items-center gap-3">
                <span className="text-body font-medium w-14 shrink-0" style={{ color: "var(--color-ink-900)" }}>{c.className}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-caption" style={{ color: "var(--color-ink-700)" }}>{c.teacherName}</p>
                  <p className="text-[11px] truncate" style={{ color: "var(--color-ink-400)" }}>{c.teacherEmail} · {c._count.students} 名學生</p>
                </div>
                <button onClick={() => setExpanded(expanded === c.id ? null : c.id)} className="text-caption px-2 py-1 rounded-input border shrink-0"
                  style={{ border: "1px solid var(--color-border)", color: "var(--color-ink-700)" }}>{expanded === c.id ? "收合" : "名單"}</button>
                <button onClick={() => openEdit(c)} className="text-caption px-2 py-1 rounded-input border shrink-0"
                  style={{ border: "1px solid var(--color-border)", color: "var(--color-ink-700)" }}>編輯</button>
                <button onClick={() => deleteClass(c.className)} className="text-caption px-1.5 py-1 rounded-input shrink-0" style={{ color: "var(--color-ink-300)" }}>×</button>
              </div>

              {expanded === c.id && (
                <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--color-border)" }}>
                  {/* Add + import */}
                  <div className="flex gap-2 mb-3 flex-wrap items-center">
                    <input placeholder="學生姓名" value={newStudent} onChange={(e) => setNewStudent(e.target.value)}
                      className="px-2 py-1.5 text-caption rounded-input border outline-none" style={inputStyle} />
                    <input placeholder="學號" value={newNumber} onChange={(e) => setNewNumber(e.target.value)}
                      className="px-2 py-1.5 text-caption rounded-input border outline-none w-20" style={inputStyle} />
                    <button onClick={() => addStudent(c.className)} className="text-caption px-3 py-1.5 rounded-input text-white" style={{ background: "var(--color-accent)" }}>加入</button>
                    <input ref={fileRef} type="file" accept=".csv,text/csv,.txt" onChange={(e) => importRoster(c.className, e)} className="hidden" />
                    <button onClick={() => fileRef.current?.click()} className="text-caption px-3 py-1.5 rounded-input border"
                      style={{ border: "1px solid var(--color-border)", color: "var(--color-ink-500)" }}>⬆ 匯入名單 CSV</button>
                  </div>
                  {c.students.length === 0 ? (
                    <p className="text-caption" style={{ color: "var(--color-ink-300)" }}>尚無學生。可手動加入或匯入 CSV（每行「姓名」或「姓名,學號」）。</p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {c.students.map((s) => (
                        <span key={s.id} className="text-caption px-2 py-1 rounded-input flex items-center gap-1.5" style={{ background: "var(--color-surface-2)", color: "var(--color-ink-700)" }}>
                          {s.classNumber ? `${s.classNumber}. ` : ""}{s.studentName}
                          <button onClick={() => removeStudent(c.className, s.studentName)} style={{ color: "var(--color-ink-300)" }}>×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
