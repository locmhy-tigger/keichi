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

  const todos = await prisma.todo.findMany({
    where: {
      createdById: session.user.id,
      ...(status    ? { status }    : {}),
      ...(committee ? { committee } : {}),
    },
    include: {
      assignee: { select: { id: true, name: true, image: true } },
    },
    orderBy: [
      { dueDate: "asc" },
    ],
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
      assignee: { select: { id: true, name: true, image: true } },
    },
  })

  return NextResponse.json(todo, { status: 201 })
}
