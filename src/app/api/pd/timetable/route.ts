import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { pdSession } from "@/lib/pd-auth"
import { getAllTeachers, getLatestTerm, matchTeacher } from "@/lib/agent-timetable"

// GET ?teacherId= — the teacher's own timetable for 板面 2, generated from the
// uploaded CSV rather than a per-teacher PDF link, so it can never disagree
// with what the clash checker uses.
export async function GET(req: NextRequest) {
  const session = await pdSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const teacherId = new URL(req.url).searchParams.get("teacherId")
  if (!teacherId) return NextResponse.json({ error: "缺少 teacherId" }, { status: 400 })

  const teacher = await prisma.user.findUnique({
    where: { id: teacherId }, select: { name: true },
  })
  if (!teacher?.name) return NextResponse.json({ error: "找不到教師" }, { status: 404 })

  const term = await getLatestTerm()
  if (!term) return NextResponse.json({ term: null, matched: null, lessons: [], periods: [] })

  const match = matchTeacher(teacher.name, await getAllTeachers(term))
  if (match.notFound || match.candidates) {
    return NextResponse.json({ term, matched: null, lessons: [], periods: [] })
  }

  const [lessons, periods] = await Promise.all([
    prisma.agentTimetable.findMany({
      where:   { teacherName: match.matched!, term },
      select:  { dayOfWeek: true, period: true, periodLabel: true, classCode: true, subject: true },
      orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }],
    }),
    prisma.schoolPeriod.findMany({ orderBy: { period: "asc" } }),
  ])

  return NextResponse.json({ term, matched: match.matched, lessons, periods })
}
