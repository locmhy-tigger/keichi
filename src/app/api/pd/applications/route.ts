import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { pdSession } from "@/lib/pd-auth"
import { checkPdClashes, datesInRange, summariseChecks } from "@/lib/pd-clash"
import { z } from "zod"

const SELECT = {
  id: true, teacherName: true, title: true, organiser: true,
  startDate: true, endDate: true, startTime: true, endTime: true,
  status: true, clashSummary: true, approvedWithClash: true,
  rejectionReason: true, reviewedAt: true, createdAt: true,
  teacher:    { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
} as const

export async function GET(req: NextRequest) {
  const session = await pdSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const status = new URL(req.url).searchParams.get("status")
  const applications = await prisma.pdApplication.findMany({
    where:   status ? { status: status as never } : {},
    select:  SELECT,
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
  })
  return NextResponse.json({ applications })
}

const createSchema = z.object({
  teacherId: z.string(),
  title:     z.string().min(1).max(200),
  organiser: z.string().max(200).optional(),
  startDate: z.string(),
  endDate:   z.string().optional(),
  startTime: z.string(),
  endTime:   z.string(),
})

export async function POST(req: NextRequest) {
  const session = await pdSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const d = createSchema.parse(await req.json())
  const teacher = await prisma.user.findUnique({
    where: { id: d.teacherId },
    select: { id: true, name: true, nameEn: true, timetableName: true },
  })
  if (!teacher?.name) return NextResponse.json({ error: "找不到教師" }, { status: 404 })

  // Record what the checker saw at creation time, so a later decision can be
  // read in context even if the timetable is re-uploaded afterwards.
  const dates  = datesInRange(d.startDate, d.endDate || d.startDate)
  const checks = await checkPdClashes({
    teacher, dates, startTime: d.startTime, endTime: d.endTime,
  })

  const created = await prisma.pdApplication.create({
    data: {
      teacherId:    teacher.id,
      teacherName:  teacher.name,
      title:        d.title,
      organiser:    d.organiser,
      startDate:    new Date(`${d.startDate}T00:00:00+08:00`),
      endDate:      new Date(`${d.endDate || d.startDate}T00:00:00+08:00`),
      startTime:    d.startTime,
      endTime:      d.endTime,
      clashSummary: summariseChecks(checks),
      createdById:  session.user.id,
    },
    select: SELECT,
  })

  return NextResponse.json(created, { status: 201 })
}
