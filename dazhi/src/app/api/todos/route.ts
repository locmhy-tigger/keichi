import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  committee:   z.enum(["ADMIN", "DISCIPLINE", "IT", "CURRICULUM"]),
  dueDate:     z.string().datetime().optional(),
  assigneeId:  z.string().optional(),
  status:      z.enum(["OPEN", "IN_PROGRESS", "DONE"]).default("OPEN"),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "TEACHER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status    = searchParams.get("status") as "OPEN" | "IN_PROGRESS" | "DONE" | null
  const committee = searchParams.get("committee") as "ADMIN" | "DISCIPLINE" | "IT" | "CURRICULUM" | null
  const view      = searchParams.get("view") // "mine" | "assigned" | null (all)

  const statusFilter    = status    ? { status }    : {}
  const committeeFilter = committee ? { committee } : {}

  let whereClause
  if (view === "mine") {
    whereClause = { createdById: session.user.id, ...statusFilter, ...committeeFilter }
  } else if (view === "assigned") {
    whereClause = { assigneeId: session.user.id, ...statusFilter, ...committeeFilter }
  } else {
    // Default: all todos where I'm creator OR assignee
    whereClause = {
      OR: [
        { createdById: session.user.id },
        { assigneeId:  session.user.id },
      ],
      ...statusFilter,
      ...committeeFilter,
    }
  }

  const todos = await prisma.todo.findMany({
    where: whereClause,
    include: {
      assignee:  { select: { id: true, name: true, image: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: [{ dueDate: "asc" }],
  })

  return NextResponse.json(todos)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "TEACHER") return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const body = await req.json()
  const data = createSchema.parse(body)

  const todo = await prisma.todo.create({
    data: {
      ...data,
      dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      createdById: session.user.id,
    },
    include: {
      assignee:  { select: { id: true, name: true, image: true } },
      createdBy: { select: { id: true, name: true } },
    },
  })

  return NextResponse.json(todo, { status: 201 })
}
