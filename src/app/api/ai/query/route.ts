import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { queryICHI } from "@/lib/claude"
import { z } from "zod"

const schema = z.object({
  query: z.string().min(1).max(500),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { query } = schema.parse(await req.json())

  const [announcements, behaviorRecords, calendarEvents, todos, activities] = await Promise.all([
    prisma.announcement.findMany({
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        title:     true,
        body:      true,
        target:    true,
        committee: true,
        priority:  true,
        createdAt: true,
        author:    { select: { name: true } },
      },
    }),
    prisma.behaviorRecord.findMany({
      where:   { authorId: session.user.id },
      orderBy: { date: "desc" },
      take:    30,
      select: {
        date:        true,
        className:   true,
        studentName: true,
        type:        true,
        description: true,
        action:      true,
        resolved:    true,
      },
    }),
    prisma.calendarEvent.findMany({
      orderBy: { startDate: "asc" },
      where:   { startDate: { gte: new Date() } },
      take:    20,
    }),
    prisma.todo.findMany({
      where:   { createdById: session.user.id, status: { not: "DONE" } },
      orderBy: { dueDate: "asc" },
      take:    20,
    }),
    prisma.activity.findMany({
      where:   { createdById: session.user.id, startTime: { gte: new Date() } },
      orderBy: { startTime: "asc" },
      take:    20,
      include: { assignments: { include: { student: { select: { name: true } } } } }
    })
  ])

  const answer = await queryKeida(query, announcements, behaviorRecords, calendarEvents, todos, activities)

  return NextResponse.json({ answer })
}
