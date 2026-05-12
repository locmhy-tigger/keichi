import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().optional(),
  startTime:   z.string().datetime(),
  endTime:     z.string().datetime().optional(),
  location:    z.string().max(200).optional(),
  committee:   z.enum(["ADMIN", "DISCIPLINE", "IT", "CURRICULUM"]).optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (session.user.role === "TEACHER") {
    const activities = await prisma.activity.findMany({
      where: { createdById: session.user.id },
      include: {
        _count: { select: { assignments: true } },
        assignments: { where: { status: "CONFIRMED" }, select: { id: true } },
      },
      orderBy: { startTime: "asc" },
    })
    return NextResponse.json(activities)
  }

  // Student: see assigned activities
  const studentActivities = await prisma.activity.findMany({
    where: {
      assignments: { some: { studentId: session.user.id } }
    },
    include: {
      assignments: {
        where: { studentId: session.user.id },
        select: { status: true, note: true }
      },
      createdBy: { select: { id: true, name: true } }
    },
    orderBy: { startTime: "asc" },
  })
  return NextResponse.json(studentActivities)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "TEACHER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const data = createSchema.parse(body)
  const { studentList, ...rest } = data
  
  const activity = await prisma.activity.create({
    data: {
      title:       data.title,
      description: data.description,
      startTime:   new Date(data.startTime),
      endTime:     data.endTime ? new Date(data.endTime) : undefined,
      location:    data.location,
      committee:   data.committee,
      createdById: session.user.id,
    },
    include: { _count: { select: { assignments: true } } },
  })

  // Process student list if provided
  if (studentList) {
    const lines = studentList.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    if (lines.length > 0) {
      const resolvedUsers = await prisma.user.findMany({
        where: {
          OR: [
            { email: { in: lines } },
            { name:  { in: lines } }
          ],
          role: "STUDENT"
        },
        select: { id: true, name: true }
      })

      if (resolvedUsers.length > 0) {
        const targetStudentIds = resolvedUsers.map(u => u.id)
        const activityEnd = activity.endTime ?? new Date(activity.startTime.getTime() + 60 * 60 * 1000)

        // Clash detection
        const clashingAssignments = await prisma.activityAssignment.findMany({
          where: {
            studentId: { in: targetStudentIds },
            activity: {
              id:        { not: activity.id },
              startTime: { lt: activityEnd },
              endTime:   { gt: activity.startTime },
            },
          },
          include: {
            activity: { select: { title: true } }
          }
        })

        const clashMap = new Map(clashingAssignments.map(a => [a.studentId, a.activity.title]))

        // Assign all
        await prisma.activityAssignment.createMany({
          data: resolvedUsers.map(user => {
            const clashTitle = clashMap.get(user.id)
            return {
              activityId: activity.id,
              studentId:  user.id,
              status:     clashTitle ? "PENDING" : "CONFIRMED" as any,
              note:       clashTitle ? `時間衝突：與「${clashTitle}」重疊` : null
            }
          }),
          skipDuplicates: true
        })
      }
    }
  }

  return NextResponse.json(activity, { status: 201 })
}
