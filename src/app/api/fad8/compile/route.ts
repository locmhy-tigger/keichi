import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isTeacherOrAdmin } from "@/lib/roles"
import { prisma } from "@/lib/prisma"
import { hkSchoolYear } from "@/lib/hk-date"
import type { NoticePayload, NoticeStudent, NoticeSession } from "@/lib/notice"

// FAD8 年度彙編 — roll a school year's activities into one row per student.
//
// FAD8 category/achievement are captured per NOTICE (fad8Category /
// fad8Achievement in the payload), so an APPROVED notice is the source of
// truth: it carries the classification AND the roster together. Drafts and
// rejected notices are excluded — an unapproved activity shouldn't land in a
// student's learning record.

const CATEGORY_MAP: Record<string, string> = {
  "1": "校外獎項及重要參與",
  "2": "德育及公民教育",
  "3": "校內及社會服務",
  "4": "體育發展",
  "5": "藝術發展",
  "6": "與工作有關的經驗",
}

export type Fad8Entry = {
  noticeId:    string
  activity:    string
  category:    string
  achievement: string
  dates:       string[]
  dept:        string
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const url  = new URL(req.url)
  const from = url.searchParams.get("from")
  const to   = url.searchParams.get("to")

  const year = hkSchoolYear()
  const start = from ? new Date(`${from}T00:00:00+08:00`) : year.start
  const end   = to   ? new Date(`${to}T00:00:00+08:00`)   : year.end

  const notices = await prisma.activityNotice.findMany({
    where:  { status: "APPROVED", updatedAt: { gte: start, lt: end } },
    select: { id: true, title: true, payload: true, updatedAt: true },
    orderBy: { updatedAt: "asc" },
  })

  // studentKey ("1A|01|陳大文") → entries
  type Row = { className: string; classNumber: string; name: string; entries: Fad8Entry[] }
  const byStudent = new Map<string, Row>()

  for (const n of notices) {
    const p = n.payload as unknown as NoticePayload & { fad8Category?: string; fad8Achievement?: string; dept?: string }
    const students = Array.isArray(p?.students) ? (p.students as NoticeStudent[]) : []
    if (students.length === 0) continue

    const entry: Omit<Fad8Entry, "noticeId"> = {
      activity:    String(p?.activityName ?? n.title),
      category:    CATEGORY_MAP[String(p?.fad8Category ?? "")] ?? "其他",
      achievement: String(p?.fad8Achievement ?? ""),
      dates:       (Array.isArray(p?.sessions) ? (p.sessions as NoticeSession[]) : [])
                     .map((s) => s?.date).filter(Boolean) as string[],
      dept:        String(p?.dept ?? ""),
    }

    for (const st of students) {
      const cls  = (st?.className ?? "").trim()
      const num  = (st?.studentId ?? "").trim()
      const name = (st?.name ?? "").trim()
      if (!name) continue
      const key = `${cls}|${num}|${name}`
      const row = byStudent.get(key) ?? { className: cls, classNumber: num, name, entries: [] }
      row.entries.push({ noticeId: n.id, ...entry })
      byStudent.set(key, row)
    }
  }

  const students = Array.from(byStudent.values()).sort(
    (a, b) =>
      a.className.localeCompare(b.className) ||
      a.classNumber.localeCompare(b.classNumber, undefined, { numeric: true }) ||
      a.name.localeCompare(b.name),
  )

  return NextResponse.json({
    period:   { from: start.toISOString().slice(0, 10), to: end.toISOString().slice(0, 10), label: year.label },
    noticeCount: notices.length,
    students,
  })
}
