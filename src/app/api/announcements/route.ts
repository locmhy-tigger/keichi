import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  title:     z.string().min(1).max(200),
  body:      z.string().min(1).max(10000),
  committee: z.enum(["ADMIN", "DISCIPLINE", "IT", "CURRICULUM"]).optional(),
  target:    z.enum(["ALL", "ADMIN", "DISCIPLINE", "IT", "CURRICULUM", "CLASS"]).default("ALL"),
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

  const data = createSchema.parse(await req.json())

  const announcement = await prisma.announcement.create({
    data: { ...data, authorId: session.user.id },
    include: {
      author: { select: { id: true, name: true, image: true } },
    },
  })

  return NextResponse.json(announcement, { status: 201 })
}
