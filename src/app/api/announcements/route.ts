import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  title:     z.string().min(1).max(200),
  body:      z.string().min(1).max(10000),
  committee: z.enum(["ADMIN", "DISCIPLINE", "IT", "CURRICULUM"]).optional(),
  target:    z.enum(["ALL", "ADMIN", "DISCIPLINE", "IT", "CURRICULUM", "CLASS"]).default("ALL"),
  priority:  z.enum(["NORMAL", "IMPORTANT", "URGENT"]).default("NORMAL"),
  classId:   z.string().optional(),
  pinned:    z.boolean().default(false),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const target = searchParams.get("target")

  let whereClause: any = {}

  if (session.user.role === "TEACHER") {
    if (target) whereClause.target = target
  } else {
    // STUDENT: can only see ALL, or their specific CLASS
    const studentEnrollments = await prisma.classEnrollment.findMany({
      where: { studentId: session.user.id },
      select: { classId: true }
    })
    const classIds = studentEnrollments.map(e => e.classId)

    whereClause = {
      OR: [
        { target: "ALL" },
        { target: "CLASS", classId: { in: classIds } }
      ]
    }
  }

  const announcements = await prisma.announcement.findMany({
    where: whereClause,
    include: {
      author: { select: { id: true, name: true, image: true } },
    },
    orderBy: [
      { priority:  "desc" }, // URGENT first (enum value order needs to be careful, but desc works if URGENT > NORMAL)
      { pinned:    "desc" },
      { createdAt: "desc" },
    ],
  })

  return NextResponse.json(announcements)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "TEACHER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { syncToGoogle, ...rest } = body
  const data = createSchema.parse(rest)

  const announcement = await prisma.announcement.create({
    data: { ...data, authorId: session.user.id },
    include: {
      author: { select: { id: true, name: true, image: true } },
    },
  })

  // Placeholder for Google Calendar Sync
  if (syncToGoogle && (session as any).accessToken) {
    // In a real implementation, we would call Google Calendar API here
    // For now, we mock the successful sync
    await prisma.announcement.update({
      where: { id: announcement.id },
      data: { googleEventId: `mock-event-${announcement.id}` }
    })
  }

  return NextResponse.json(announcement, { status: 201 })
}
