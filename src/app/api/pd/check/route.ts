import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { pdSession } from "@/lib/pd-auth"
import { checkPdClashes, datesInRange } from "@/lib/pd-clash"
import { z } from "zod"

// POST — live clash check for 板面 1. Saves nothing.
const schema = z.object({
  teacherId: z.string(),
  startDate: z.string(),
  endDate:   z.string().optional(),
  startTime: z.string(),
  endTime:   z.string(),
})

export async function POST(req: NextRequest) {
  const session = await pdSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { teacherId, startDate, endDate, startTime, endTime } = schema.parse(await req.json())

  const teacher = await prisma.user.findUnique({
    where: { id: teacherId },
    select: { id: true, name: true, nameEn: true, timetableName: true },
  })
  if (!teacher?.name) return NextResponse.json({ error: "找不到教師" }, { status: 404 })

  const dates  = datesInRange(startDate, endDate || startDate)
  const checks = await checkPdClashes({ teacher, dates, startTime, endTime })

  return NextResponse.json({ teacherName: teacher.name, checks })
}
