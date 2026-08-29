import { prisma } from "@/lib/prisma"
import { overlaps, type Window } from "@/lib/clash"
import { getAllTeachers, getLatestTerm, periodLabelOf, WEEKDAY_NAMES } from "@/lib/agent-timetable"
import { resolveAgainstTimetable } from "@/lib/teacher-match"

// ─────────────────────────────────────────────────────────────
// 教師進修 clash checking.
//
// Answers "is this teacher teaching between X and Y on date D". Three things
// had to be built for this to be answerable at all: AgentTimetable stores bare
// period numbers with no clock times (SchoolPeriod supplies them), there was no
// concept of school being out (NonTeachingPeriod), and timetables are keyed by
// free-text name rather than a user id.
// ─────────────────────────────────────────────────────────────

export type PdDayCheck =
  | { date: string; kind: "clear";          reason: string }
  | { date: string; kind: "clash";          lessons: string[] }
  | { date: string; kind: "no-data";        teacherName: string }
  | { date: string; kind: "not-configured" }

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/

/** "HH:MM" → minutes since midnight, or null when malformed. */
export function toMinutes(t: string): number | null {
  const m = HHMM.exec(t.trim())
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null
}

/** Minute-based window on an arbitrary shared day, so `overlaps` can be reused. */
function windowFromMinutes(from: number, to: number): Window {
  return { start: new Date(from * 60_000), end: new Date(to * 60_000) }
}

/** Every HK date from `from` to `to` inclusive, as YYYY-MM-DD. */
export function datesInRange(from: string, to: string): string[] {
  const out: string[] = []
  const start = new Date(`${from}T00:00:00+08:00`)
  const end   = new Date(`${to}T00:00:00+08:00`)
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) return out
  for (let d = start; d <= end; d = new Date(d.getTime() + 86_400_000)) {
    // Read back in HK so the label matches the day the user picked.
    out.push(new Date(d.getTime() + 8 * 3600_000).toISOString().slice(0, 10))
    if (out.length > 90) break // guard against a runaway range
  }
  return out
}

/** HK weekday (0=Sun … 6=Sat) for a YYYY-MM-DD. */
function hkWeekday(ymd: string): number {
  return new Date(`${ymd}T12:00:00+08:00`).getUTCDay()
}

export type CheckInput = {
  /** The account being checked — all three name fields are tried. */
  teacher: { name: string | null; nameEn: string | null; timetableName: string | null }
  dates:       string[]   // YYYY-MM-DD
  startTime:   string     // "HH:MM"
  endTime:     string
}

export async function checkPdClashes(input: CheckInput): Promise<PdDayCheck[]> {
  const from = toMinutes(input.startTime)
  const to   = toMinutes(input.endTime)
  if (from === null || to === null || to <= from) {
    return input.dates.map((date) => ({ date, kind: "clear", reason: "時間無效" }))
  }
  const requested = windowFromMinutes(from, to)

  const [periods, nonTeaching, term] = await Promise.all([
    prisma.schoolPeriod.findMany(),
    prisma.nonTeachingPeriod.findMany(),
    getLatestTerm(),
  ])

  // Without period clock times nothing can be compared. Say so rather than
  // reporting a reassuring "冇衝突" that means nothing.
  if (periods.length === 0) {
    return input.dates.map((date) => ({ date, kind: "not-configured" as const }))
  }

  const periodWindow = new Map<number, Window>()
  const namedWindow  = new Map<string, { window: Window; startTime: string; endTime: string }>()
  for (const p of periods) {
    const s = toMinutes(p.startTime), e = toMinutes(p.endTime)
    if (s === null || e === null || e <= s) continue
    const w = windowFromMinutes(s, e)
    if (p.period !== null)  periodWindow.set(p.period, w)
    else if (p.label)       namedWindow.set(p.label, { window: w, startTime: p.startTime, endTime: p.endTime })
  }

  // Timetables are keyed by free-text name. A teacher whose account name
  // differs from the CSV yields nothing — which must NOT read as "free".
  const allTeachers = term ? await getAllTeachers(term) : []
  const match = resolveAgainstTimetable(input.teacher, allTeachers)
  if (!term || !match.ok) {
    const shown = input.teacher.name ?? input.teacher.nameEn ?? "—"
    return input.dates.map((date) => ({ date, kind: "no-data" as const, teacherName: shown }))
  }
  const resolved = match.timetableName

  const lessons = await prisma.agentTimetable.findMany({
    where:  { teacherName: resolved, term },
    select: { dayOfWeek: true, period: true, periodLabel: true, classCode: true, subject: true },
  })

  return input.dates.map((date): PdDayCheck => {
    // 1. Holidays and exam periods win over the timetable.
    const day = new Date(`${date}T12:00:00+08:00`)
    const cover = nonTeaching.find((n) => day >= n.startDate && day <= n.endDate)
    if (cover) {
      if (cover.type === "HOLIDAY") return { date, kind: "clear", reason: `${cover.name}（非上課日）` }
      const freeFrom = cover.freeFrom ? toMinutes(cover.freeFrom) : null
      if (freeFrom !== null && from >= freeFrom) {
        return { date, kind: "clear", reason: `${cover.name}（${cover.freeFrom} 後可外出）` }
      }
      if (freeFrom !== null) {
        return { date, kind: "clash", lessons: [`${cover.name}：${cover.freeFrom} 前不可外出`] }
      }
      return { date, kind: "clear", reason: cover.name }
    }

    // 2. Weekends have no timetable rows at all.
    const wd = hkWeekday(date)
    if (wd === 0 || wd === 6) return { date, kind: "clear", reason: "星期六／日" }

    // 3. Compare against that weekday's lessons.
    const hits: string[] = []
    for (const l of lessons.filter((x) => x.dayOfWeek === wd)) {
      const where = `${l.classCode ?? "—"} ${l.subject ?? ""}`.trim()
      if (l.period === 0) {
        // Named slot (早會/周會): look its time up by label. If the admin
        // hasn't given it one, flag it rather than pass silently.
        const named = l.periodLabel ? namedWindow.get(l.periodLabel) : undefined
        if (!named) {
          hits.push(`${periodLabelOf(l)}　${where}（時間未設定，請自行確認）`)
        } else if (overlaps(named.window, requested)) {
          hits.push(`${periodLabelOf(l)}　${where}（${named.startTime}–${named.endTime}）`)
        }
        continue
      }
      const w = periodWindow.get(l.period)
      if (!w) {
        hits.push(`${periodLabelOf(l)}　${where}（此節未設定時間）`)
        continue
      }
      if (overlaps(w, requested)) {
        const p = periods.find((x) => x.period === l.period)!
        hits.push(`${periodLabelOf(l)}　${where}（${p.startTime}–${p.endTime}）`)
      }
    }

    return hits.length > 0
      ? { date, kind: "clash", lessons: hits }
      : { date, kind: "clear", reason: `星期${WEEKDAY_NAMES[wd]}此時段無課` }
  })
}

/** One-line summary stored on the application when it is decided. */
export function summariseChecks(checks: PdDayCheck[]): string {
  return checks.map((c) => {
    if (c.kind === "clash")          return `${c.date}：有衝突 — ${c.lessons.join("；")}`
    if (c.kind === "no-data")        return `${c.date}：找不到「${c.teacherName}」的時間表`
    if (c.kind === "not-configured") return `${c.date}：節次時間未設定`
    return `${c.date}：冇衝突（${c.reason}）`
  }).join("\n")
}

export function hasBlocking(checks: PdDayCheck[]): boolean {
  return checks.some((c) => c.kind === "clash" || c.kind === "no-data" || c.kind === "not-configured")
}
