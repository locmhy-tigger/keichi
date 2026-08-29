import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/roles"
import { prisma } from "@/lib/prisma"
import { getAllTeachers, getLatestTerm } from "@/lib/agent-timetable"
import { resolveAgainstTimetable } from "@/lib/teacher-match"

// GET — the 教師資料 grid, pre-filled with every staff account plus how each
// one currently resolves against the uploaded timetable. Surfacing the match
// here is the whole point: a name that fails to resolve is invisible until it
// makes 教師進修 report 「找不到時間表」.
export async function GET() {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const [teachers, term] = await Promise.all([
    prisma.user.findMany({
      where:   { role: { in: ["TEACHER", "ADMIN"] } },
      select:  { id: true, name: true, nameEn: true, email: true, department: true, timetableName: true, role: true },
      orderBy: [{ department: "asc" }, { name: "asc" }],
    }),
    getLatestTerm(),
  ])

  const names = term ? await getAllTeachers(term) : []

  const rows = teachers.map((t) => {
    const res = names.length ? resolveAgainstTimetable(t, names) : null
    return {
      ...t,
      match: res === null
        ? { ok: false as const, reason: "no-timetable" as const }
        : res.ok
          ? { ok: true as const, timetableName: res.timetableName, via: res.via }
          : { ok: false as const, reason: "unmatched" as const, tried: res.tried },
    }
  })

  return NextResponse.json({ term, timetableNames: names, teachers: rows })
}
