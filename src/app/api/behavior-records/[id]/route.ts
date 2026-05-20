import { isTeacherOrAdmin } from "@/lib/roles"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const patchSchema = z.object({
  resolved:    z.boolean().optional(),
  description: z.string().optional(),
  action:      z.string().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user || !isTeacherOrAdmin(session.user.role) && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const record = await prisma.behaviorRecord.findUnique({ where: { id: params.id } })
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (record.authorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const data    = patchSchema.parse(await req.json())
  const updated = await prisma.behaviorRecord.update({
    where: { id: params.id },
    data,
    include: { author: { select: { id: true, name: true } } },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user || !isTeacherOrAdmin(session.user.role) && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const record = await prisma.behaviorRecord.findUnique({ where: { id: params.id } })
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (record.authorId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  await prisma.behaviorRecord.delete({ where: { id: params.id } })
  return NextResponse.json({ deleted: true })
}
