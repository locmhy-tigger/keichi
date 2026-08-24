import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isTeacherOrAdmin } from "@/lib/roles"
import { findClashes, type Window } from "@/lib/clash"
import { z } from "zod"

// Check a roster against existing activities before anything is saved, so the
// notice form can flag 時間衝突 per student while the teacher is still editing.
const schema = z.object({
  studentIds: z.array(z.string()).max(500),
  // Each session contributes one window; times are optional (falls back to a
  // whole-day window, which is the safe/greedy choice for an all-day notice).
  sessions: z.array(z.object({
    date:       z.string(),
    arriveTime: z.string().optional(),
    leaveTime:  z.string().optional(),
  })).max(30),
  excludeActivityId: z.string().optional(),
})

const HHMM = /^\d{1,2}:\d{2}$/

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { studentIds, sessions, excludeActivityId } = schema.parse(await req.json())

  const windows: Window[] = []
  for (const s of sessions) {
    if (!s.date) continue
    const from = HHMM.test(s.arriveTime ?? "") ? s.arriveTime! : "00:00"
    const to   = HHMM.test(s.leaveTime  ?? "") ? s.leaveTime!  : "23:59"
    const start = new Date(`${s.date}T${from.padStart(5, "0")}:00`)
    const end   = new Date(`${s.date}T${to.padStart(5, "0")}:00`)
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) continue
    windows.push({ start, end })
  }

  if (studentIds.length === 0 || windows.length === 0) {
    return NextResponse.json({ clashes: [] })
  }

  const hits = await findClashes(studentIds, windows, excludeActivityId)

  // One entry per student, carrying every clashing title.
  const byStudent = new Map<string, string[]>()
  for (const h of hits) {
    const list = byStudent.get(h.studentId) ?? []
    if (!list.includes(h.title)) list.push(h.title)
    byStudent.set(h.studentId, list)
  }

  return NextResponse.json({
    clashes: Array.from(byStudent, ([studentId, titles]) => ({ studentId, titles })),
  })
}
