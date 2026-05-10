import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const schema = z.object({
  studentIds: z.array(z.string()).min(1),
})

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "TEACHER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const activity = await prisma.activity.findUnique({ where: { id: params.id } })
  if (!activity) return NextResponse.json({ error: "Activity not found" }, { status: 404 })
  if (activity.createdById !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { studentIds } = schema.parse(await req.json())

  // Clash detection: find other activities overlapping this one for each student
  const activityEnd = activity.endTime ?? new Date(activity.startTime.getTime() + 60 * 60 * 1000) // +1hr default

  const clashingAssignments = await prisma.activityAssignment.findMany({
    where: {
      studentId: { in: studentIds },
      activity: {
        id:        { not: params.id },
        startTime: { lt: activityEnd },
        endTime:   { gt: activity.startTime },
      },
    },
    include: {
      student:  { select: { id: true, name: true } },
      activity: { select: { id: true, title: true, startTime: true, endTime: true } },
    },
  })

  const clashes = clashingAssignments.map((a) => ({
    studentId:   a.studentId,
    studentName: a.student.name,
    activity:    { id: a.activity.id, title: a.activity.title, startTime: a.activity.startTime },
  }))

  const clashingStudentIds = new Set(clashes.map((c) => c.studentId))
  const safeStudentIds     = studentIds.filter((id) => !clashingStudentIds.has(id))

  // Assign non-clashing students (skip already assigned)
  const assigned: { studentId: string }[] = []
  for (const studentId of safeStudentIds) {
    try {
      await prisma.activityAssignment.create({
        data: { activityId: params.id, studentId },
      })
      assigned.push({ studentId })
    } catch {
      // Already assigned — skip
    }
  }

  return NextResponse.json({ assigned, clashes })
}
