"use client"

import { useEffect, useState } from "react"

type AttendanceStatus = "PENDING" | "CONFIRMED" | "ATTENDED" | "ABSENT"

type Activity = {
  id:        string
  title:     string
  startTime: string
  endTime:   string | null
  location:  string | null
  assignments: { status: AttendanceStatus }[]
}

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  PENDING:   "var(--color-ink-400)",
  CONFIRMED: "var(--color-accent)",
  ATTENDED:  "var(--color-curriculum)",
  ABSENT:    "var(--color-discipline)",
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  PENDING:   "待確認",
  CONFIRMED: "已確認",
  ATTENDED:  "出席",
  ABSENT:    "缺席",
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

export default function StudentCalendarPage() {
  const [activities, setActivities] = useState<Activity[]>([])
  const [loading,    setLoading]    = useState(true)
  const [current,    setCurrent]    = useState(() => new Date())
  const [selected,   setSelected]   = useState<Activity | null>(null)

  useEffect(() => {
    fetch("/api/activities")
      .then((r) => r.ok ? r.json() : [])
      .then((data: Activity[]) => { setActivities(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const year  = current.getFullYear()
  const month = current.getMonth()

  function prevMonth() { setCurrent(new Date(year, month - 1, 1)) }
  function nextMonth() { setCurrent(new Date(year, month + 1, 1)) }

  // Build 6×7 grid
  const firstDay  = new Date(year, month, 1)
  const startDay  = new Date(firstDay)
  startDay.setDate(startDay.getDate() - firstDay.getDay())

  const days: Date[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDay)
    d.setDate(startDay.getDate() + i)
    days.push(d)
  }

  const today = new Date()

  function activitiesForDay(day: Date) {
    return activities.filter((a) => isSameDay(new Date(a.startTime), day))
  }

  const monthNames = ["一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"]
  const dayNames   = ["日","一","二","三","四","五","六"]

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-h1">活動行事曆</h1>
        <p className="text-body mt-0.5" style={{ color: "var(--color-ink-500)" }}>
          你的活動安排（只讀，由老師指派）
        </p>
      </div>

      <div className="card overflow-hidden">
        {/* Month header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid var(--color-border)" }}
        >
          <button
            onClick={prevMonth}
            className="p-1.5 rounded-md transition-colors hover:bg-[var(--color-surface-2)]"
            style={{ color: "var(--color-ink-700)" }}
          >
            ←
          </button>
          <h2 className="text-h2">
            {year}年 {monthNames[month]}
          </h2>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded-md transition-colors hover:bg-[var(--color-surface-2)]"
            style={{ color: "var(--color-ink-700)" }}
          >
            →
          </button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 border-b" style={{ borderColor: "var(--color-border)" }}>
          {dayNames.map((d) => (
            <div
              key={d}
              className="text-center py-2 text-caption font-medium"
              style={{ color: "var(--color-ink-500)" }}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day cells */}
        {loading ? (
          <div className="p-8 text-center text-body" style={{ color: "var(--color-ink-300)" }}>載入中…</div>
        ) : (
          <div className="grid grid-cols-7">
            {days.map((day, idx) => {
              const inMonth   = day.getMonth() === month
              const isToday   = isSameDay(day, today)
              const dayActs   = activitiesForDay(day)

              return (
                <div
                  key={idx}
                  className="min-h-[80px] p-1.5 border-b border-r"
                  style={{
                    borderColor: "var(--color-border)",
                    background:  inMonth ? "var(--color-surface)" : "var(--color-surface-2)",
                  }}
                >
                  <div className="flex justify-center mb-1">
                    <span
                      className={`text-caption font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday ? "text-white" : ""
                      }`}
                      style={{
                        background: isToday ? "var(--color-accent)" : "transparent",
                        color:      isToday ? "white" : inMonth ? "var(--color-ink-900)" : "var(--color-ink-300)",
                      }}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {dayActs.slice(0, 2).map((act) => {
                      const status = act.assignments[0]?.status ?? "PENDING"
                      return (
                        <button
                          key={act.id}
                          onClick={() => setSelected(act)}
                          className="w-full text-left px-1 py-0.5 rounded text-caption truncate"
                          style={{
                            background: STATUS_COLORS[status] + "20",
                            color:      STATUS_COLORS[status],
                            fontSize:   "10px",
                          }}
                        >
                          {formatTime(act.startTime)} {act.title}
                        </button>
                      )
                    })}
                    {dayActs.length > 2 && (
                      <p className="text-caption text-center" style={{ color: "var(--color-ink-400)", fontSize: "10px" }}>
                        +{dayActs.length - 2}
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Activity detail popover */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30"
          onClick={() => setSelected(null)}
        >
          <div
            className="card p-6 max-w-sm w-full space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-h3">{selected.title}</h3>
              <button
                onClick={() => setSelected(null)}
                className="text-body shrink-0"
                style={{ color: "var(--color-ink-400)" }}
              >
                ✕
              </button>
            </div>
            {(() => {
              const status = selected.assignments[0]?.status ?? "PENDING"
              return (
                <span
                  className="text-caption font-medium px-2 py-0.5 rounded-pill inline-block"
                  style={{ background: STATUS_COLORS[status] + "20", color: STATUS_COLORS[status] }}
                >
                  {STATUS_LABELS[status]}
                </span>
              )
            })()}
            <p className="text-body" style={{ color: "var(--color-ink-700)" }}>
              📅 {new Date(selected.startTime).toLocaleDateString("zh-HK", {
                year: "numeric", month: "long", day: "numeric",
              })} {formatTime(selected.startTime)}
              {selected.endTime && ` — ${formatTime(selected.endTime)}`}
            </p>
            {selected.location && (
              <p className="text-body" style={{ color: "var(--color-ink-700)" }}>
                📍 {selected.location}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
