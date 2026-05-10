"use client"

import { useState } from "react"

type Todo = { dueDate: string | null; status: string }

type CalendarEventMin = {
  startDate: string
  committee: "ADMIN" | "DISCIPLINE" | "IT" | "CURRICULUM" | null
}

const COMMITTEE_COLORS: Record<string, string> = {
  ADMIN:      "var(--color-admin)",
  DISCIPLINE: "var(--color-discipline)",
  IT:         "var(--color-it)",
  CURRICULUM: "var(--color-curriculum)",
}

const WEEK_DAYS = ["日", "一", "二", "三", "四", "五", "六"]
const MONTHS = ["一月","二月","三月","四月","五月","六月","七月","八月","九月","十月","十一月","十二月"]

function buildCalendarDays(year: number, month: number) {
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const daysInPrev  = new Date(year, month, 0).getDate()

  const days: { date: number; currentMonth: boolean; iso: string }[] = []

  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrev - i
    days.push({ date: d, currentMonth: false, iso: `${year}-${month.toString().padStart(2,"0")}-${d.toString().padStart(2,"0")}` })
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ date: d, currentMonth: true, iso: `${year}-${(month+1).toString().padStart(2,"0")}-${d.toString().padStart(2,"0")}` })
  }
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    days.push({ date: d, currentMonth: false, iso: `${year}-${(month+2).toString().padStart(2,"0")}-${d.toString().padStart(2,"00")}` })
  }
  return days
}

export function MiniCalendar({ todos, calendarEvents = [] }: { todos: Todo[]; calendarEvents?: CalendarEventMin[] }) {
  const now = new Date()
  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())

  const todoDates = new Set(
    todos
      .filter((t) => t.dueDate && t.status !== "DONE")
      .map((t) => t.dueDate!.slice(0, 10))
  )

  const eventsByDate = calendarEvents.reduce<Record<string, CalendarEventMin[]>>((acc, ev) => {
    const iso = ev.startDate.slice(0, 10)
    if (!acc[iso]) acc[iso] = []
    acc[iso].push(ev)
    return acc
  }, {})

  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`

  function prev() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function next() {
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }

  const days = buildCalendarDays(year, month)

  return (
    <div className="card p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-h3">
          {MONTHS[month]} · {month >= 2 ? year : year}
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={prev}
            className="w-6 h-6 flex items-center justify-center rounded-md transition-colors hover:bg-[var(--color-surface-2)]"
            style={{ color: "var(--color-ink-500)" }}
            aria-label="上月"
          >
            ‹
          </button>
          <button
            onClick={next}
            className="w-6 h-6 flex items-center justify-center rounded-md transition-colors hover:bg-[var(--color-surface-2)]"
            style={{ color: "var(--color-ink-500)" }}
            aria-label="下月"
          >
            ›
          </button>
        </div>
      </div>

      {/* Week day headers */}
      <div className="grid grid-cols-7 mb-1">
        {WEEK_DAYS.map((d) => (
          <div key={d} className="text-center text-caption" style={{ color: "var(--color-ink-300)" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {days.map((day, i) => {
          const isToday     = day.iso === todayStr && day.currentMonth
          const hasTodo     = todoDates.has(day.iso)
          const dayEvents   = eventsByDate[day.iso] ?? []
          const eventColor  = dayEvents[0]?.committee
            ? COMMITTEE_COLORS[dayEvents[0].committee]
            : dayEvents.length > 0 ? "var(--color-accent)" : null
          return (
            <div key={i} className="flex flex-col items-center">
              <div
                className={`w-7 h-7 flex items-center justify-center rounded-full text-body transition-colors ${
                  isToday ? "text-white font-medium" : ""
                }`}
                style={{
                  background: isToday ? "var(--color-accent)" : "transparent",
                  color: isToday
                    ? "white"
                    : day.currentMonth
                    ? "var(--color-ink-900)"
                    : "var(--color-ink-200)",
                }}
              >
                {day.date}
              </div>
              <div className="flex gap-0.5 mt-0.5 h-1">
                {hasTodo && day.currentMonth && (
                  <div className="w-1 h-1 rounded-full" style={{ background: "var(--color-accent)" }} />
                )}
                {eventColor && day.currentMonth && (
                  <div className="w-1 h-1 rounded-full" style={{ background: eventColor }} />
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
