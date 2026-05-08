import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const patchSchema = z.object({
  title:       z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  committee:   z.enum(["ADMIN", "DISCIPLINE", "IT", "CURRICULUM"]).optional(),
  dueDate:     z.string().datetime().nullable().optional(),
  assigneeId:  z.string().nullable().optional(),
  status:      z.enum(["OPEN", "IN_PROGRESS", "DONE"]).optional(),
})

async function getOwned(id: string, userId: string) {
  const todo = await prisma.todo.findUnique({ where: { id } })
  if (!todo) return null
  if (todo.createdById !== userId) return null
  return todo
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const todo = await getOwned(params.id, session.user.id)
  if (!todo) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json(todo)
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const owned = await getOwned(params.id, session.user.id)
  if (!owned) return NextResponse.json({ error: "Not found or forbidden" }, { status: 403 })

  const data = patchSchema.parse(await req.json())

  const updated = await prisma.todo.update({
    where: { id: params.id },
    data: {
      ...data,
      dueDate: data.dueDate !== undefined
        ? (data.dueDate === null ? null : new Date(data.dueDate))
        : undefined,
    },
    include: {
      assignee: { select: { id: true, name: true, image: true } },
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const owned = await getOwned(params.id, session.user.id)
  if (!owned) return NextResponse.json({ error: "Not found or forbidden" }, { status: 403 })

  await prisma.todo.delete({ where: { id: params.id } })

  return NextResponse.json({ deleted: true })
}
