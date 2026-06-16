import { isTeacherOrAdmin } from "@/lib/roles"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  title:     z.string().min(1).max(200),
  body:      z.string().min(1).max(10000),
  committee: z.enum(["ADMIN", "DISCIPLINE", "IT", "CURRICULUM", "ECA"]).optional(),
  target:    z.enum(["ALL", "ADMIN", "DISCIPLINE", "IT", "CURRICULUM", "ECA", "CLASS"]).default("ALL"),
  priority:  z.enum(["NORMAL", "IMPORTANT", "URGENT"]).default("NORMAL"),
  classId:   z.string().optional(),
  pinned:    z.boolean().default(false),
  publishAt: z.string().optional().transform(v => v ? new Date(v) : undefined),
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
    // STUDENT: can only see ALL, or their specific CLASS, and only if publishAt <= now
    const studentEnrollments = await prisma.classEnrollment.findMany({
      where: { studentId: session.user.id },
      select: { classId: true }
    })
    const classIds = studentEnrollments.map(e => e.classId)

    whereClause = {
      publishAt: { lte: new Date() },
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
      { priority:  "desc" },
      { pinned:    "desc" },
      { publishAt: "desc" },
    ],
  })

  return NextResponse.json(announcements)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isTeacherOrAdmin(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const { syncToGoogle, ...rest } = body
  const data = createSchema.parse(rest)

  const announcement = await prisma.announcement.create({
    data: { ...data, authorId: session.user.id },
    include: {
      author: { select: { id: true, name: true, image: true } },
    },
  })

  // Google Calendar Sync Implementation
  if (syncToGoogle && (session as any).accessToken) {
    try {
      const googleRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${(session as any).accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: announcement.title,
          description: announcement.body,
          start: {
            dateTime: new Date(announcement.createdAt).toISOString(),
          },
          end: {
            dateTime: new Date(announcement.createdAt.getTime() + 3600000).toISOString(), // 1 hour duration
          },
        }),
      })

      if (googleRes.ok) {
        const event = await googleRes.json()
        await prisma.announcement.update({
          where: { id: announcement.id },
          data: { googleEventId: event.id }
        })
      } else {
        const error = await googleRes.text()
        console.error("Google Calendar Sync failed:", error)
      }
    } catch (err) {
      console.error("Google Calendar Sync error:", err)
    }
  }

  return NextResponse.json(announcement, { status: 201 })
}
