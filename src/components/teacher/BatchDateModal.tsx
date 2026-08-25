"use client"

import { useState } from "react"

// Multi-date picker, shared by 活動文件 (session dates) and 活動總覽 (one
// activity repeated over several dates). Extracted from activity-docs so the
// two cannot drift apart.

const WEEKDAYS  = ["星期日","星期一","星期二","星期三","星期四","星期五","星期六"]
const MONTHS_ZH = ["一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"]

export function BatchCalendarModal({
  onConfirm,
  onClose,
  lastDate,
  accent = "var(--color-admin)",
}: {
  onConfirm: (dates: string[]) => void
  onClose: () => void
  lastDate?: string
  /** Accent colour so the picker matches whichever page opened it. */
  accent?: string
}) {
  const now = lastDate ? new Date(lastDate + "T00:00:00") : new Date()
  const [calYear, setCalYear] = useState(now.getFullYear())
  const [calMonth, setCalMonth] = useState(now.getMonth())
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const todayStr = (() => {
    const t = new Date()
    return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`
  })()

  const firstDow = (new Date(calYear, calMonth, 1).getDay() + 6) % 7 // Mon=0
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()

  function toggle(ds: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(ds) ? next.delete(ds) : next.add(ds)
      return next
    })
  }
  function prevMonth() {
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
  }

  const sorted = Array.from(selected).sort()

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-white rounded-2xl shadow-2xl p-6 w-80 max-w-[95vw]">
        <div className="flex items-center justify-between mb-3">
          <button onClick={prevMonth} className="w-8 h-8 flex items-center justify-center border rounded-lg hover:bg-gray-50 text-sm">◀</button>
          <span className="font-bold text-sm" style={{ color: accent }}>{calYear}年{MONTHS_ZH[calMonth]}</span>
          <button onClick={nextMonth} className="w-8 h-8 flex items-center justify-center border rounded-lg hover:bg-gray-50 text-sm">▶</button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 mb-2">
          {["一","二","三","四","五","六","日"].map(d => (
            <div key={d} className="text-center text-[10px] font-bold text-gray-400 py-1">{d}</div>
          ))}
          {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1
            const ds = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`
            const isSel = selected.has(ds)
            const isToday = ds === todayStr
            return (
              <button
                key={ds}
                onClick={() => toggle(ds)}
                className={`text-center text-xs py-1.5 rounded-md transition-colors ${
                  isSel ? "text-white font-bold" : "hover:bg-gray-100"
                } ${isToday && !isSel ? "outline outline-2 outline-offset-[-2px]" : ""}`}
                style={{
                  background: isSel ? accent : undefined,
                  outlineColor: isToday && !isSel ? accent : undefined,
                }}
              >{d}</button>
            )
          })}
        </div>
        <div className="min-h-10 bg-gray-50 border rounded-lg p-2 text-[11px] text-gray-500 mb-2 max-h-28 overflow-y-auto leading-6">
          {sorted.length === 0 ? "（未選擇任何日期）" : sorted.map(ds => {
            const [y,m,d] = ds.split("-").map(Number)
            return `${String(d).padStart(2,"0")}/${String(m).padStart(2,"0")}/${y}（${WEEKDAYS[new Date(y,m-1,d).getDay()]}）`
          }).join("　")}
        </div>
        {sorted.length > 0 && <p className="text-[11px] text-gray-400 mb-2">已選 {sorted.length} 個日期</p>}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">取消</button>
          <button
            onClick={() => { onConfirm(sorted); onClose() }}
            className="px-4 py-2 text-sm font-bold text-white rounded-lg"
            style={{ background: accent }}
          >確認新增</button>
        </div>
      </div>
    </div>
  )
}
