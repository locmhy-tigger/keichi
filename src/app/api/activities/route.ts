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
  const assignments = await prisma.activityAssignment.findMany({
    where: { studentId: session.user.id },
    include: {
      activity: {
        include: { createdBy: { select: { id: true, name: true } } },
      },
    },
    orderBy: { activity: { startTime: "asc" } },
  })
  return NextResponse.json(assignments)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "TEACHER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const data = createSchema.parse(await req.json())
  const activity = await prisma.activity.create({
    data: {
      ...data,
      startTime:   new Date(data.startTime),
      endTime:     data.endTime ? new Date(data.endTime) : undefined,
      createdById: session.user.id,
    },
    include: { _count: { select: { assignments: true } } },
  })

  return NextResponse.json(activity, { status: 201 })
}
