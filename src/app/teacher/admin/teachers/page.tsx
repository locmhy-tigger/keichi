"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"

// 教師資料 — the staff counterpart of 學生資料.
// Columns: 中文姓名 → 英文姓名 → 電郵 → 科組 → 時間表姓名
//
// The last column is the important one. AgentTimetable is keyed by free text,
// so an account whose name differs from the CSV silently fails to resolve and
// 教師進修 reports 「找不到時間表」. This page shows that match state for every
// teacher and lets an admin fix it with an explicit override.

type Match =
  | { ok: true;  timetableName: string; via: "override" | "name" | "nameEn" }
  | { ok: false; reason: "unmatched"; tried: string[] }
  | { ok: false; reason: "no-timetable" }

type Row = {
  id:            number
  nameZh:        string
  nameEn:        string
  email:         string
  department:    string
  timetableName: string
  match?:        Match
  status?:       { ok: boolean; message: string }
}

const FIELDS: Array<keyof Row> = ["nameZh", "nameEn", "email", "department", "timetableName"]

const blank = (id: number): Row =>
  ({ id, nameZh: "", nameEn: "", email: "", department: "", timetableName: "" })

const VIA = { override: "指定", name: "中文姓名", nameEn: "英文姓名" } as const

export default function AdminTeachersPage() {
  const [rows,    setRows]    = useState<Row[]>([])
  const [names,   setNames]   = useState<string[]>([])
  const [term,    setTerm]    = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [summary, setSummary] = useState<string | null>(null)
  const [err,     setErr]     = useState<string | null>(null)
  const nextId   = useRef(1)
  const tableRef = useRef<HTMLTableElement>(null)

  async function load() {
    setLoading(true); setErr(null)
    const res = await fetch("/api/admin/teachers")
    if (!res.ok) {
      setErr(res.status === 403 ? "僅管理員可使用此頁。" : `載入失敗 (${res.status})`)
      setLoading(false)
      return
    }
    const d = await res.json()
    setTerm(d.term ?? null)
    setNames(d.timetableNames ?? [])
    const loaded: Row[] = (d.teachers ?? []).map((t: any) => ({
      id:            nextId.current++,
      nameZh:        t.name ?? "",
      nameEn:        t.nameEn ?? "",
      email:         t.email ?? "",
      department:    t.department ?? "",
      timetableName: t.timetableName ?? "",
      match:         t.match,
    }))
    // Always leave a few empty rows to paste into.
    setRows([...loaded, ...Array.from({ length: 3 }, () => blank(nextId.current++))])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function update(id: number, field: keyof Row, value: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value, status: undefined } : r))
  }
  function addRow()              { setRows(prev => [...prev, blank(nextId.current++)]) }
  function removeRow(id: number) { setRows(prev => prev.filter(r => r.id !== id)) }

  // Paste a block of Excel cells starting at the focused cell.
  function handlePaste(e: React.ClipboardEvent<HTMLTableElement>) {
    const target = e.target as HTMLElement
    if (!target.closest("tbody")) return
    e.preventDefault()

    const lines = e.clipboardData.getData("text/plain").split(/\r?\n/).filter(l => l.trim())
    if (!lines.length) return

    const focusTr  = target.closest("tr")
    const allTrs   = Array.from(tableRef.current?.querySelectorAll("tbody tr") ?? [])
    const startRow = focusTr ? allTrs.indexOf(focusTr as HTMLTableRowElement) : rows.length
    const inputs   = focusTr ? Array.from(focusTr.querySelectorAll("input")) : []
    let   startCol = inputs.indexOf(target as HTMLInputElement)
    if (startCol < 0) startCol = 0

    setRows(prev => {
      const next = [...prev]
      lines.forEach((raw, ri) => {
        const cols   = raw.split("\t").map(c => c.trim())
        const rowIdx = startRow + ri
        while (rowIdx >= next.length) next.push(blank(nextId.current++))
        cols.forEach((val, ci) => {
          const f = FIELDS[startCol + ci]
          if (f) next[rowIdx] = { ...next[rowIdx], [f]: val, status: undefined }
        })
      })
      return next
    })
  }

  async function save() {
    setSaving(true); setErr(null); setSummary(null)
    try {
      const res = await fetch("/api/admin/teachers/bulk", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          rows: rows.map(({ id, nameZh, nameEn, email, department, timetableName }) =>
            ({ id, nameZh, nameEn, email, department, timetableName })),
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setErr(d?.error ?? `儲存失敗 (${res.status})`)
        setSaving(false)
        return
      }
      const { created, updated, results } = await res.json() as {
        created: number; updated: number
        results: { id: number; ok: boolean; message: string }[]
      }
      const byId = new Map(results.map(r => [r.id, r]))
      setRows(prev => prev.map(r => {
        const hit = byId.get(r.id)
        return hit ? { ...r, status: { ok: hit.ok, message: hit.message } } : r
      }))
      const failed = results.filter(r => !r.ok).length
      setSummary(`已新增 ${created} 人 · 已更新 ${updated} 人${failed ? ` · ${failed} 行未處理` : ""}`)
      // Re-read so the 時間表 column reflects the names just saved.
      setTimeout(load, 600)
    } catch {
      setErr("儲存失敗，請重試。")
    }
    setSaving(false)
  }

  const cell = "w-full bg-transparent px-2 py-1 text-sm rounded focus:bg-white focus:outline-2 focus:outline-[var(--color-accent)]"
  const th   = "bg-gray-700 text-white text-xs font-bold px-2 py-2 text-left"

  const unmatched = rows.filter(r => r.email && r.match && !r.match.ok && r.match.reason === "unmatched").length

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <Link href="/teacher" className="text-caption" style={{ color: "var(--color-ink-400)" }}>← 老師主頁</Link>
        <span style={{ color: "var(--color-ink-300)" }}>/</span>
        <h1 className="text-h1">教師資料</h1>
      </div>
      <p className="text-caption mb-5" style={{ color: "var(--color-ink-400)" }}>
        以電郵作識別：重複貼上同一位教師只會更新資料。「時間表姓名」用來對照已上載的時間表；如果系統自動配對唔到，喺該欄填上時間表上的寫法即可。
      </p>

      <div className="card p-5">
        <div className="flex items-start gap-2 p-3 rounded-lg border text-xs text-blue-800 mb-3"
          style={{ background: "#f0f7ff", borderColor: "#b3d1f5" }}>
          <span>🧑‍🏫</span>
          <span>
            從 Excel 複製後，<strong>點擊任何一格再按 Ctrl+V</strong>。欄位順序：
            <strong>中文姓名 → 英文姓名 → 電郵 → 科組 → 時間表姓名</strong>。
            {term
              ? <> 現時對照學期 <strong>{term}</strong>（{names.length} 個時間表姓名）。</>
              : <> 尚未上載時間表，未能顯示配對狀態。</>}
          </span>
        </div>

        {unmatched > 0 && (
          <p className="text-caption mb-3" style={{ color: "var(--color-admin)" }}>
            ⚠ 有 {unmatched} 位教師未能對照時間表 — 教師進修的衝突檢查對佢哋會顯示「找不到時間表」。
          </p>
        )}

        {loading ? (
          <p className="text-caption" style={{ color: "var(--color-ink-400)" }}>載入中…</p>
        ) : (
        <div className="overflow-x-auto">
          <table ref={tableRef} className="w-full text-sm border-collapse" onPaste={handlePaste}>
            <thead>
              <tr>
                <th className={`${th} text-center w-8`}>#</th>
                <th className={th}>中文姓名</th>
                <th className={th}>英文姓名</th>
                <th className={th}>電郵</th>
                <th className={th}>科組</th>
                <th className={th}>時間表姓名</th>
                <th className={th}>時間表配對</th>
                <th className={th}>狀態</th>
                <th className="bg-gray-700 text-white w-8" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id} className={idx % 2 === 1 ? "bg-gray-50" : "bg-white"}>
                  <td className="text-center text-xs text-gray-400 px-2 py-1">{idx + 1}</td>
                  <td className="px-1 py-0.5"><input className={cell} placeholder="盧智明"
                    value={r.nameZh} onChange={e => update(r.id, "nameZh", e.target.value)} /></td>
                  <td className="px-1 py-0.5"><input className={cell} placeholder="LO CHI MING"
                    value={r.nameEn} onChange={e => update(r.id, "nameEn", e.target.value)} /></td>
                  <td className="px-1 py-0.5"><input className={cell} placeholder="name@ga.keichi.edu.hk"
                    value={r.email} onChange={e => update(r.id, "email", e.target.value)} /></td>
                  <td className="px-1 py-0.5"><input className={cell} style={{ minWidth: 80 }} placeholder="電腦科"
                    value={r.department} onChange={e => update(r.id, "department", e.target.value)} /></td>
                  <td className="px-1 py-0.5">
                    <input className={cell} list="timetable-names" placeholder="（自動配對）"
                      value={r.timetableName} onChange={e => update(r.id, "timetableName", e.target.value)} />
                  </td>
                  <td className="px-2 py-1 text-xs whitespace-nowrap">
                    {!r.match ? null
                      : r.match.ok ? (
                        <span style={{ color: "var(--color-curriculum)" }}>
                          ✓ {r.match.timetableName}
                          <span style={{ color: "var(--color-ink-300)" }}>（{VIA[r.match.via]}）</span>
                        </span>
                      ) : r.match.reason === "no-timetable" ? (
                        <span style={{ color: "var(--color-ink-300)" }}>—</span>
                      ) : (
                        <span style={{ color: "var(--color-admin)" }}>⚠ 找不到</span>
                      )}
                  </td>
                  <td className="px-2 py-1 text-xs whitespace-nowrap">
                    {r.status && (
                      <span style={{ color: r.status.ok ? "var(--color-curriculum)" : "var(--color-discipline)" }}>
                        {r.status.ok ? "✓" : "⚠"} {r.status.message}
                      </span>
                    )}
                  </td>
                  <td className="px-1 py-0.5">
                    <button type="button" onClick={() => removeRow(r.id)}
                      className="w-7 h-7 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="從此表移除（不會刪除帳戶）">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <datalist id="timetable-names">
            {names.map(n => <option key={n} value={n} />)}
          </datalist>
        </div>
        )}

        <div className="flex items-center gap-3 mt-3">
          <button type="button" onClick={addRow}
            className="text-xs font-bold px-4 py-1.5 rounded-lg border-2 border-dashed"
            style={{ borderColor: "var(--color-accent)", color: "var(--color-accent)", background: "#f0f4ff" }}>
            + 新增行
          </button>
          <button type="button" onClick={load}
            className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: "var(--color-border)", color: "var(--color-ink-500)" }}>
            重新載入
          </button>
          <span className="text-xs text-gray-400 ml-auto">
            {rows.filter(r => r.email.trim()).length} 位教師
          </span>
        </div>

        {err     && <p className="text-caption mt-3" style={{ color: "var(--color-discipline)" }}>{err}</p>}
        {summary && <p className="text-caption mt-3" style={{ color: "var(--color-curriculum)" }}>✓ {summary}</p>}

        <div className="flex justify-end mt-4">
          <button onClick={save} disabled={saving || loading}
            className="px-4 py-2 text-body font-medium rounded-input text-white"
            style={{ background: "var(--color-accent)", opacity: saving ? 0.7 : 1 }}>
            {saving ? "儲存中…" : "儲存教師資料"}
          </button>
        </div>
      </div>
    </div>
  )
}
