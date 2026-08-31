"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { StudentRosterInput, makeRow, type RosterRow } from "@/components/teacher/StudentRosterInput"
import { BatchCalendarModal } from "@/components/teacher/BatchDateModal"

type Enrollment = { classNumber: string | null; class: { name: string } }

type Assignment = {
  id:      string
  status?: string
  note?:   string | null
  student?: { id: string; name: string | null; enrollments: Enrollment[] }
}

type Activity = {
  id:          string
  title:       string
  approval?:   "PENDING" | "APPROVED" | "REJECTED"
  description: string | null
  startTime:   string
  endTime:     string | null
  location:    string | null
  committee:   string | null
  _count:      { assignments: number }
  assignments: Assignment[]
}

type ViewMode = "all" | "today" | "week" | "class" | "student" | "pending"

type NoticeRow = {
  id: string
  title: string
  committee: string
  status: string
  updatedAt: string
  createdBy?: { id: string; name: string | null }
}

const COMMITTEE_LABEL: Record<string, string> = {
  ADMIN: "行政", DISCIPLINE: "訓育", IT: "資訊科技",
  CURRICULUM: "課程發展", ECA: "課外活動", STUDENT_SUPPORT: "學生支援",
}

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth()+1}月${d.getDate()}日 ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`
}

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"]

const APPROVAL_BADGE: Record<string, { label: string; color: string }> = {
  PENDING:  { label: "待批核", color: "var(--color-admin)" },
  REJECTED: { label: "已退回", color: "var(--color-discipline)" },
}

// Same heuristic as /api/homeroom: only 1A-6Z style names are real form classes,
// so a student in several groups is still filed under one class.
const FORM_CLASS = /^[1-6][A-Z]$/
function formClassOf(a: Assignment): string | null {
  const hit = a.student?.enrollments?.find((e) => FORM_CLASS.test(e.class.name.trim()))
  return hit?.class.name.trim() ?? a.student?.enrollments?.[0]?.class.name.trim() ?? null
}
function classNumberOf(a: Assignment): string | null {
  const hit = a.student?.enrollments?.find((e) => FORM_CLASS.test(e.class.name.trim()))
  return hit?.classNumber ?? a.student?.enrollments?.[0]?.classNumber ?? null
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`
}
/** Monday-start week containing `d`. */
function weekRange(d: Date): { from: Date; to: Date } {
  const from = new Date(d); from.setHours(0,0,0,0)
  from.setDate(from.getDate() - ((from.getDay() + 6) % 7))
  const to = new Date(from); to.setDate(to.getDate() + 7)
  return { from, to }
}
/** 課外活動 usually run after school or at weekends — worth calling out. */
function whenLabel(iso: string): string | null {
  const d = new Date(iso)
  const day = d.getDay()
  if (day === 0 || day === 6) return "週末"
  if (d.getHours() >= 15) return "放學後"
  return null
}

export default function TeacherActivitiesPage() {
  const [activities, setActivities]   = useState<Activity[]>([])
  const [loading,    setLoading]      = useState(true)
  const [showForm,   setShowForm]     = useState(false)
  const [saving,     setSaving]       = useState(false)
  const [formError,  setFormError]    = useState<string | null>(null)

  // Filters
  const [searchQ,    setSearchQ]      = useState("")
  const [weekdayFilter, setWeekdayFilter] = useState<number | null>(null)
  const [sortBy,     setSortBy]       = useState<"date" | "students" | "title">("date")
  const [view,       setView]         = useState<ViewMode>("all")
  const [pickedDate, setPickedDate]   = useState<string>("")
  const [studentQ,   setStudentQ]     = useState("")

  // Form state
  const [title,   setTitle]   = useState("")
  const [desc,    setDesc]    = useState("")
  const [start,   setStart]   = useState("")
  const [end,     setEnd]     = useState("")
  const [location, setLocation] = useState("")
  const [activityType, setActivityType] = useState<"" | "ECA" | "ACADEMIC">("")
  // 負責組別 — was never sent, so every activity created here ended up
  // untagged. Options come from the server so a restricted committee is only
  // offered to its own members.
  const [committee, setCommittee] = useState("")
  const [committeeOptions, setCommitteeOptions] = useState<{ value: string; label: string }[]>([])

  // Extra dates — an Activity holds ONE startTime, so a repeated activity
  // becomes one row per date (the same shape notice approval produces, and
  // what attendance needs since it is taken per occasion).
  const [extraDates, setExtraDates] = useState<string[]>([])
  const [showDates,  setShowDates]  = useState(false)

  // 匯入文件 — AI reads an existing notice and fills this form.
  const [importing, setImporting] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  // Pending NOTICES awaiting this user's sign-off, shown in the same 待批核
  // queue as pending activities so a chair has one place to look.
  const [pendingNotices, setPendingNotices] = useState<NoticeRow[]>([])

  // Student roster (班級/學號/姓名 grid) + the accounts it resolved to.
  const [roster,       setRoster]       = useState<RosterRow[]>([makeRow(1)])
  const [resolvedIds,  setResolvedIds]  = useState<string[]>([])
  const [resolving,    setResolving]    = useState(false)
  const [matchSummary, setMatchSummary] = useState<{ matched: number; unmatched: number } | null>(null)

  // Match roster rows to student accounts so the teacher sees who was found
  // (and who wasn't) BEFORE saving, rather than losing rows silently.
  // Upload an existing notice; the model proposes values which are mapped onto
  // THIS form (title / dates / times / location / roster). Notice-only fields
  // (通告編號, 正文, FAD8) are dropped — this page doesn't generate documents.
  // Nothing is saved: the teacher reviews and presses 建立 themselves.
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true); setFormError(null)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res  = await fetch("/api/activity-notices/extract", { method: "POST", body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setFormError(data?.error ?? `匯入失敗 (${res.status})`); return }

      const p = data.payload ?? {}
      if (p.activityName) setTitle(p.activityName)
      if (p.bodyText)     setDesc(p.bodyText)

      const sessions: any[] = Array.isArray(p.sessions) ? p.sessions.filter((x: any) => x?.date) : []
      if (sessions.length > 0) {
        const first = sessions[0]
        if (first.location) setLocation(first.location)
        // The first dated session becomes 開始時間; the rest become extra dates,
        // which is exactly the multi-date shape this form already handles.
        const t = /^\d{1,2}:\d{2}$/.test(first.arriveTime ?? "") ? first.arriveTime : "00:00"
        setStart(`${first.date}T${String(t).padStart(5, "0")}`)
        if (/^\d{1,2}:\d{2}$/.test(first.leaveTime ?? "")) {
          setEnd(`${first.date}T${String(first.leaveTime).padStart(5, "0")}`)
        }
        setExtraDates(Array.from(new Set(sessions.slice(1).map((x: any) => x.date))).sort() as string[])
      }

      if (Array.isArray(p.students) && p.students.length) {
        setRoster(p.students.map((x: any, i: number) => makeRow(
          i + 1, x.className ?? "", x.studentId ?? "", x.name ?? "",
        )))
        setResolvedIds([]); setMatchSummary(null)
      }

      const bits = [
        sessions.length ? `${sessions.length} 個日期` : null,
        Array.isArray(p.students) && p.students.length ? `${p.students.length} 位學生` : null,
      ].filter(Boolean)
      setFormError(null)
      setShowForm(true)
      window.alert(`已匯入並填入表單${bits.length ? `（${bits.join("、")}）` : ""}。\n請核對內容後再建立。`)
    } catch {
      setFormError("匯入失敗，請重試")
    } finally {
      setImporting(false)
      if (importRef.current) importRef.current.value = ""
    }
  }

  // Sign off a pending NOTICE from the same queue as pending activities.
  async function reviewNotice(id: string, action: "approve" | "reject") {
    let reason: string | undefined
    if (action === "reject") {
      const r = window.prompt("退回原因（會通知建立者）：")
      if (!r?.trim()) return
      reason = r.trim()
    } else if (!confirm("批核後會自動加入行事曆，並建立活動記錄及出席名單。確定批核？")) return

    const res = await fetch(`/api/activity-notices/${id}/review`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, rejectionReason: reason }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      window.alert(d?.error ?? "操作失敗")
      return
    }
    const d = await res.json()
    window.alert(action === "approve"
      ? `已批核。\n行事曆：${d.calendarEventsCreated ?? 0} 項\n活動記錄：${d.activitiesCreated ?? 0} 項`
      : "已退回。")
    loadNotices(); load()
  }

  async function resolveRoster(): Promise<string[] | null> {
    setResolving(true)
    try {
      const res = await fetch("/api/students/resolve", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ rows: roster.map(({ id, className, studentId, name }) => ({ id, className, studentId, name })) }),
      })
      if (!res.ok) throw new Error()
      const { results } = await res.json() as {
        results: { id: number; matched: boolean; userId?: string; name?: string | null; email?: string | null }[]
      }
      const byId = new Map(results.map((r) => [r.id, r]))

      setRoster((prev) => prev.map((row) => {
        const hit = byId.get(row.id)
        if (!hit) return { ...row, status: undefined }
        return {
          ...row,
          status: hit.matched
            ? { ok: true,  label: hit.email ?? hit.name ?? "已配對" }
            : { ok: false, label: "找不到" },
        }
      }))

      const ids = results.filter((r) => r.matched && r.userId).map((r) => r.userId!)
      setResolvedIds(ids)
      // Only count rows the teacher actually filled in.
      const filled = roster.filter((r) => r.name.trim() || (r.className.trim() && r.studentId.trim())).length
      setMatchSummary({ matched: ids.length, unmatched: Math.max(0, filled - ids.length) })
      setResolving(false)
      return ids
    } catch {
      setFormError("配對失敗，請重試。")
      setResolving(false)
      return null
    }
  }

  function resetRoster() {
    setRoster([makeRow(1)]); setResolvedIds([]); setMatchSummary(null)
  }

  async function load() {
    setLoading(true)
    const res = await fetch("/api/activities?withStudents=1")
    if (res.ok) setActivities(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    fetch("/api/committees")
      .then((r) => r.ok ? r.json() : { committees: [] })
      .then((d) => setCommitteeOptions(d.committees ?? []))
      .catch(() => {})
  }, [])

  const loadNotices = () => {
    // 403 simply means this user chairs nothing — an empty queue, not an error.
    fetch("/api/activity-notices?scope=review")
      .then((r) => r.ok ? r.json() : { notices: [] })
      .then((d) => setPendingNotices(d.notices ?? []))
      .catch(() => {})
  }
  useEffect(() => { loadNotices() }, [])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError(null)

    if (end && new Date(end) <= new Date(start)) {
      setFormError("截止時間不可早於或等於開始時間")
      setSaving(false)
      return
    }

    // If the teacher filled the roster but never pressed 配對, resolve now —
    // otherwise those students would be silently dropped on save.
    let ids = resolvedIds
    const filledRows = roster.filter((r) => r.name.trim() || (r.className.trim() && r.studentId.trim())).length
    if (filledRows > 0 && matchSummary === null) {
      const resolved = await resolveRoster()
      if (resolved === null) { setSaving(false); return }
      ids = resolved
    }

    // Every chosen date gets its own activity, keeping the time-of-day from
    // the 開始/結束時間 fields.
    const allStarts = [start, ...extraDates.map((d) => `${d}T${start.slice(11)}`)]

    try {
      const createdAll: Activity[] = []
      let failed = 0
      for (const st of allStarts) {
        const endForDate = end
          ? `${st.slice(0, 10)}T${end.slice(11)}`
          : undefined
        const res = await fetch("/api/activities", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            description: desc || undefined,
            startTime:    new Date(st).toISOString(),
            endTime:      endForDate ? new Date(endForDate).toISOString() : undefined,
            location:     location || undefined,
            activityType: activityType || undefined,
            committee:    committee || undefined,
            studentIds:   ids.length ? ids : undefined,
          }),
        })
        if (res.ok) createdAll.push(await res.json())
        else failed++
      }

      if (createdAll.length > 0) {
        setActivities((prev) => [...createdAll, ...prev])
        if (failed > 0) {
          setFormError(`已建立 ${createdAll.length} 個活動，${failed} 個失敗。`)
        }
        setTitle(""); setDesc(""); setStart(""); setEnd(""); setLocation(""); setActivityType(""); setCommittee("")
        setExtraDates([])
        resetRoster()
        if (failed === 0) setShowForm(false)
      } else {
        setFormError("建立失敗，請重試")
      }
    } catch {
      setFormError("網絡錯誤，請檢查連接後重試")
    } finally {
      setSaving(false)
    }
  }

  const pendingCount =
    activities.filter((a) => a.approval === "PENDING").length + pendingNotices.length

  const inputCls   = "w-full px-3 py-2 text-body rounded-input border outline-none"
  const inputStyle = { border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-ink-900)" }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-h1">活動總覽</h1>
          <p className="text-body mt-0.5" style={{ color: "var(--color-ink-500)" }}>建立活動、指派學生，並按日期、班別或學生查看誰要出席</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/api/activities/export"
            className="text-caption px-3 py-2 rounded-input border"
            style={{ border: "1px solid var(--color-border)", color: "var(--color-ink-500)" }}
          >
            ⬇ 匯出 CSV
          </a>
          <input ref={importRef} type="file" hidden onChange={handleImport}
            accept=".docx,.txt,.pdf,image/*,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />
          <button
            onClick={() => importRef.current?.click()}
            disabled={importing}
            className="text-caption px-3 py-2 rounded-input border"
            style={{ border: "1px solid var(--color-accent)", color: "var(--color-accent)", opacity: importing ? 0.5 : 1 }}
            title="上載現有通告，由 AI 整理並填入表單"
          >
            {importing ? "識別中…" : "📄 匯入文件"}
          </button>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="px-4 py-2 rounded-input text-body font-medium text-white"
            style={{ background: "var(--color-accent)" }}
          >
            + 新增活動
          </button>
        </div>
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

          {/* Repeat over several dates — one activity per date. */}
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <label className="text-caption" style={{ color: "var(--color-ink-700)" }}>其他日期（選填）</label>
              <button type="button" onClick={() => setShowDates(true)} disabled={!start}
                className="text-caption font-medium"
                style={{ color: "var(--color-accent)", opacity: start ? 1 : 0.5 }}
                title={start ? "選擇多個日期" : "請先填寫開始時間"}>
                🗓 選擇多個日期
              </button>
              {extraDates.length > 0 && (
                <button type="button" onClick={() => setExtraDates([])}
                  className="text-caption" style={{ color: "var(--color-ink-400)" }}>清除</button>
              )}
            </div>
            {extraDates.length === 0 ? (
              <p className="text-[11px]" style={{ color: "var(--color-ink-400)" }}>
                同一活動在多個日期舉行時，可一次選取；系統會為每個日期建立一個活動（出席按次記錄）。
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {extraDates.map((d) => (
                  <span key={d} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-pill text-caption"
                    style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}>
                    {d}
                    <button type="button" onClick={() => setExtraDates((p) => p.filter((x) => x !== d))}>×</button>
                  </span>
                ))}
                <span className="text-caption self-center" style={{ color: "var(--color-ink-400)" }}>
                  連同開始日期，共 {extraDates.length + 1} 個活動
                </span>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-caption block mb-1" style={{ color: "var(--color-ink-700)" }}>活動類型（選填）</label>
              <select value={activityType} onChange={(e) => setActivityType(e.target.value as "" | "ECA" | "ACADEMIC")}
                className={inputCls} style={inputStyle}>
                <option value="">不指定</option>
                <option value="ECA">課外活動（星期一、二）</option>
                <option value="ACADEMIC">學科活動（星期三至五）</option>
              </select>
            </div>
            <div>
              <label className="text-caption block mb-1" style={{ color: "var(--color-ink-700)" }}>負責組別（選填）</label>
              <select value={committee} onChange={(e) => setCommittee(e.target.value)}
                className={inputCls} style={inputStyle}>
                <option value="">— 沒有 —</option>
                {committeeOptions
                  .filter((c) => c.value !== "SCHOOL")
                  .map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-caption block mb-1" style={{ color: "var(--color-ink-700)" }}>地點（選填）</label>
              <input value={location} onChange={(e) => setLocation(e.target.value)}
                placeholder="課室、禮堂…" className={inputCls} style={inputStyle} />
            </div>
          </div>
          {(() => {
            if (!activityType || !start) return null
            const wd = new Date(start).getDay()
            const ok = activityType === "ECA" ? [1, 2].includes(wd) : [3, 4, 5].includes(wd)
            if (ok) return null
            return (
              <p className="text-caption px-3 py-2 rounded-input" style={{ background: "var(--color-admin-soft, #fff7ed)", color: "var(--color-admin, #b45309)" }}>
                ⚠ {activityType === "ECA" ? "課外活動建議於星期一、二舉辦" : "學科活動建議於星期三至五舉辦"}，你選的日期不在建議範圍內。
              </p>
            )
          })()}
          <div>
            <label className="text-caption block mb-1" style={{ color: "var(--color-ink-700)" }}>備注（選填）</label>
            <textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)}
              className={`${inputCls} resize-none`} style={inputStyle} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-caption font-medium" style={{ color: "var(--color-ink-700)" }}>學生名單（選填）</label>
              <button type="button" onClick={resolveRoster} disabled={resolving || roster.length === 0}
                className="text-caption font-medium" style={{ color: "var(--color-accent)", opacity: resolving || roster.length === 0 ? 0.5 : 1 }}>
                {resolving ? "配對中…" : "配對學生帳戶"}
              </button>
            </div>
            <StudentRosterInput
              rows={roster}
              onChange={setRoster}
              footnote="貼上後按「配對學生帳戶」，系統會以班級＋學號找出對應學生（連電郵），並在儲存時檢查時間衝突。"
            />
            {matchSummary && (
              <p className="text-caption mt-2" style={{ color: matchSummary.unmatched > 0 ? "var(--color-discipline)" : "var(--color-curriculum)" }}>
                已配對 {matchSummary.matched} 人
                {matchSummary.unmatched > 0 && ` · ${matchSummary.unmatched} 人找不到帳戶（將不會被加入）`}
              </p>
            )}
          </div>
          {formError && (
            <p className="text-caption px-3 py-2 rounded-input" style={{ background: "var(--color-discipline-soft, #fef2f2)", color: "var(--color-discipline, #dc2626)" }}>
              {formError}
            </p>
          )}
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

      {showDates && (
        <BatchCalendarModal
          accent="var(--color-accent)"
          lastDate={start ? start.slice(0, 10) : undefined}
          onClose={() => setShowDates(false)}
          onConfirm={(dates) => {
            // The primary date already has its own activity — drop it if the
            // teacher also ticked it in the picker, so it isn't created twice.
            const primary = start.slice(0, 10)
            setExtraDates(Array.from(new Set(dates.filter((d) => d !== primary))).sort())
          }}
        />
      )}

      {/* View modes */}
      {!loading && (activities.length > 0 || pendingNotices.length > 0) && (
        <div className="flex gap-2 items-center flex-wrap mb-3">
          <div className="flex gap-1 p-1 rounded-input" style={{ background: "var(--color-surface-2)" }}>
            {([["all","全部"],["today","今日"],["week","本週"],["class","按班別"],["student","按學生"],["pending",`待批核${pendingCount ? ` (${pendingCount})` : ""}`]] as const).map(([id, label]) => (
              <button key={id} onClick={() => setView(id)}
                className="px-3 py-1.5 text-caption font-medium rounded-input transition-colors"
                style={{
                  background: view === id ? "var(--color-surface)" : "transparent",
                  color:      view === id ? "var(--color-ink-900)" : "var(--color-ink-500)",
                  boxShadow:  view === id ? "0 1px 3px rgb(0 0 0 / 0.06)" : "none",
                }}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-caption" style={{ color: "var(--color-ink-400)" }}>指定日期：</span>
            <input type="date" value={pickedDate} onChange={(e) => setPickedDate(e.target.value)}
              className="text-caption px-2 py-1 rounded-input border"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface)", color: "var(--color-ink-700)" }} />
            {pickedDate && (
              <button onClick={() => setPickedDate("")} className="text-caption" style={{ color: "var(--color-accent)" }}>清除</button>
            )}
          </div>
          {view === "student" && (
            <input value={studentQ} onChange={(e) => setStudentQ(e.target.value)}
              placeholder="搜尋學生姓名…"
              className="text-caption px-2 py-1 rounded-input border flex-1 min-w-[160px]"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface)", color: "var(--color-ink-900)" }} />
          )}
        </div>
      )}

      {/* Filter bar */}
      {!loading && activities.length > 0 && (
        <div className="mb-4 space-y-3">
          {/* Search */}
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            placeholder="搜尋活動名稱或地點…"
            className="w-full px-3 py-2 text-body rounded-input border outline-none"
            style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)", color: "var(--color-ink-900)" }}
          />
          <div className="flex gap-2 flex-wrap items-center">
            {/* Weekday chips */}
            <span className="text-caption" style={{ color: "var(--color-ink-400)" }}>星期：</span>
            {WEEKDAYS.map((d, i) => (
              <button
                key={i}
                onClick={() => setWeekdayFilter(weekdayFilter === i ? null : i)}
                className="text-caption px-2.5 py-1 rounded-full border transition-colors"
                style={{
                  background: weekdayFilter === i ? "var(--color-accent)" : "var(--color-surface)",
                  color:      weekdayFilter === i ? "#fff" : "var(--color-ink-700)",
                  borderColor: weekdayFilter === i ? "var(--color-accent)" : "var(--color-border)",
                }}
              >
                {d}
              </button>
            ))}
            {/* Sort */}
            <div className="ml-auto flex items-center gap-1.5">
              <span className="text-caption" style={{ color: "var(--color-ink-400)" }}>排序：</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "date" | "students" | "title")}
                className="text-caption px-2 py-1 rounded-input border"
                style={{ borderColor: "var(--color-border)", color: "var(--color-ink-700)", background: "var(--color-surface)" }}
              >
                <option value="date">日期</option>
                <option value="students">學生人數</option>
                <option value="title">名稱</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Pending NOTICES — same queue as pending activities, so a chair has one
          place to sign things off rather than two. */}
      {view === "pending" && pendingNotices.length > 0 && (
        <div className="card p-4 mb-4">
          <h3 className="text-h3 mb-1">待批核通告</h3>
          <p className="text-caption mb-3" style={{ color: "var(--color-ink-400)" }}>
            批核後會自動加入行事曆，並建立活動記錄及出席名單。
          </p>
          <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
            {pendingNotices.map((n) => (
              <li key={n.id} className="py-3 flex items-center gap-2 flex-wrap">
                <div className="flex-1 min-w-0">
                  <p className="text-body font-medium truncate" style={{ color: "var(--color-ink-900)" }}>{n.title}</p>
                  <p className="text-caption" style={{ color: "var(--color-ink-400)" }}>
                    通告 · {COMMITTEE_LABEL[n.committee] ?? n.committee} · {n.createdBy?.name ?? "老師"} · {new Date(n.updatedAt).toLocaleDateString("zh-HK")}
                  </p>
                </div>
                <Link href={`/teacher/committee/admin/activity-docs?id=${n.id}`}
                  className="text-caption font-medium" style={{ color: "var(--color-accent)" }}>檢視內容</Link>
                <button onClick={() => reviewNotice(n.id, "approve")}
                  className="text-caption font-medium px-3 py-1.5 rounded-input text-white"
                  style={{ background: "var(--color-curriculum)" }}>批核</button>
                <button onClick={() => reviewNotice(n.id, "reject")}
                  className="text-caption font-medium px-3 py-1.5 rounded-input"
                  style={{ color: "var(--color-discipline)" }}>退回</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-body" style={{ color: "var(--color-ink-300)" }}>載入中…</div>
      ) : activities.length === 0 ? (
        view === "pending" && pendingNotices.length > 0 ? null : (
          <div className="text-center py-12 text-body" style={{ color: "var(--color-ink-300)" }}>尚未建立任何活動</div>
        )
      ) : (() => {
        const now = new Date()
        const todayStr = ymd(now)
        const { from: wkFrom, to: wkTo } = weekRange(now)

        const filtered = activities
          .filter((a) => {
            const q = searchQ.toLowerCase()
            const matchQ = !q || a.title.toLowerCase().includes(q) || (a.location ?? "").toLowerCase().includes(q)
            const matchDay = weekdayFilter === null || new Date(a.startTime).getDay() === weekdayFilter

            const start = new Date(a.startTime)
            // 指定日期 overrides the view's own date window, so a teacher can ask
            // "who has something on this day" from any tab.
            const matchPicked = !pickedDate || ymd(start) === pickedDate
            const matchView =
              view === "pending" ? true
              : pickedDate ? true
              : view === "today" ? ymd(start) === todayStr
              : view === "week"  ? (start >= wkFrom && start < wkTo)
              : true

            // 待批核 shows only what needs a decision. Other views show
            // everything — staff should still see pending items, and each card
            // carries a status badge — but rejected ones are noise.
            const matchApproval =
              view === "pending" ? a.approval === "PENDING" : a.approval !== "REJECTED"

            return matchQ && matchDay && matchPicked && matchView && matchApproval
          })
          .sort((a, b) => {
            if (sortBy === "students") return b._count.assignments - a._count.assignments
            if (sortBy === "title") return a.title.localeCompare(b.title)
            return new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
          })
        if (filtered.length === 0) {
          return <div className="text-center py-12 text-body" style={{ color: "var(--color-ink-300)" }}>沒有符合的活動</div>
        }

        // 按班別 — one card per class, listing who from it has to attend what.
        if (view === "class") {
          const byClass = new Map<string, { act: Activity; a: Assignment }[]>()
          for (const act of filtered) {
            for (const a of act.assignments) {
              if (!a.student) continue
              const cls = formClassOf(a) ?? "未分班"
              const list = byClass.get(cls) ?? []
              list.push({ act, a })
              byClass.set(cls, list)
            }
          }
          if (byClass.size === 0) {
            return <div className="text-center py-12 text-body" style={{ color: "var(--color-ink-300)" }}>此範圍內的活動未有學生名單</div>
          }
          return (
            <div className="space-y-4">
              {Array.from(byClass.keys()).sort().map((cls) => {
                const rows = byClass.get(cls)!
                return (
                  <div key={cls} className="card p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-h3">{cls}</h3>
                      <span className="text-caption" style={{ color: "var(--color-ink-400)" }}>{rows.length} 人次</span>
                    </div>
                    <ul className="divide-y" style={{ borderColor: "var(--color-border)" }}>
                      {rows
                        .sort((x, y) => new Date(x.act.startTime).getTime() - new Date(y.act.startTime).getTime())
                        .map(({ act, a }) => (
                          <li key={`${act.id}-${a.id}`} className="py-2 flex items-center gap-2 text-body">
                            <span style={{ color: "var(--color-ink-900)" }}>
                              {classNumberOf(a) ? `${classNumberOf(a)}. ` : ""}{a.student!.name ?? "—"}
                            </span>
                            <Link href={`/teacher/activities/${act.id}`} className="truncate" style={{ color: "var(--color-accent)" }}>
                              {act.title}
                            </Link>
                            <span className="text-caption ml-auto shrink-0" style={{ color: "var(--color-ink-400)" }}>
                              {formatDateTime(act.startTime)}{whenLabel(act.startTime) ? ` · ${whenLabel(act.startTime)}` : ""}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          )
        }

        // 按學生 — what one student has to attend.
        if (view === "student") {
          const q = studentQ.trim().toLowerCase()
          const byStudent = new Map<string, { name: string; cls: string | null; items: Activity[] }>()
          for (const act of filtered) {
            for (const a of act.assignments) {
              if (!a.student) continue
              const name = a.student.name ?? "—"
              if (q && !name.toLowerCase().includes(q)) continue
              const cur = byStudent.get(a.student.id) ?? { name, cls: formClassOf(a), items: [] }
              cur.items.push(act)
              byStudent.set(a.student.id, cur)
            }
          }
          if (byStudent.size === 0) {
            return <div className="text-center py-12 text-body" style={{ color: "var(--color-ink-300)" }}>
              {q ? "沒有符合的學生" : "此範圍內的活動未有學生名單"}
            </div>
          }
          return (
            <div className="space-y-3">
              {Array.from(byStudent.values())
                .sort((a, b) => (a.cls ?? "").localeCompare(b.cls ?? "") || a.name.localeCompare(b.name))
                .map((st) => (
                  <div key={st.name + (st.cls ?? "")} className="card p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-h3">{st.name}</h3>
                      {st.cls && <span className="text-caption px-2 py-0.5 rounded-pill"
                        style={{ background: "var(--color-surface-2)", color: "var(--color-ink-500)" }}>{st.cls}</span>}
                      <span className="text-caption ml-auto" style={{ color: "var(--color-ink-400)" }}>{st.items.length} 項活動</span>
                    </div>
                    <ul className="space-y-1">
                      {st.items
                        .sort((x, y) => new Date(x.startTime).getTime() - new Date(y.startTime).getTime())
                        .map((act) => (
                          <li key={act.id} className="flex items-center gap-2 text-body">
                            <Link href={`/teacher/activities/${act.id}`} className="truncate" style={{ color: "var(--color-accent)" }}>{act.title}</Link>
                            <span className="text-caption ml-auto shrink-0" style={{ color: "var(--color-ink-400)" }}>
                              {formatDateTime(act.startTime)}{whenLabel(act.startTime) ? ` · ${whenLabel(act.startTime)}` : ""}
                            </span>
                          </li>
                        ))}
                    </ul>
                  </div>
                ))}
            </div>
          )
        }

        return (
        <div className="space-y-3">
          {filtered.map((act) => (
            <Link
              key={act.id}
              href={`/teacher/activities/${act.id}`}
              className="card p-5 block hover:shadow-card-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-h3">{act.title}</h3>
                    {act.approval && APPROVAL_BADGE[act.approval] && (
                      <span className="text-caption px-2 py-0.5 rounded-pill shrink-0"
                        style={{
                          background: APPROVAL_BADGE[act.approval].color + "20",
                          color:      APPROVAL_BADGE[act.approval].color,
                        }}>
                        {APPROVAL_BADGE[act.approval].label}
                      </span>
                    )}
                  </div>
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
        )
      })()}
    </div>
  )
}
