import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isTeacherOrAdmin, canEditCommittee } from "@/lib/roles"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

// GET — list homeroom (班主任) assignments, auto-seeding any class names that
// appear in behavior records but have no assignment yet.
export async function GET() {
  const session = await auth()
  if (!session?.user || !isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const [assignments, distinctClasses] = await Promise.all([
    prisma.homeroomClass.findMany({ orderBy: { className: "asc" } }),
    prisma.behaviorRecord.findMany({ distinct: ["className"], select: { className: true } }),
  ])

  const known = new Set(assignments.map((a) => a.className))
  const unassigned = distinctClasses
    .map((c) => c.className)
    .filter((c) => !known.has(c))
    .sort()

  return NextResponse.json({ assignments, unassigned })
}

const upsertSchema = z.object({
  className:     z.string().min(1).max(50),
  teacherName:   z.string().min(1).max(100),
  teacherEmail:  z.string().email(),
  teacherUserId: z.string().optional().nullable(),
})

// PUT — create/update one homeroom assignment (admin / discipline chair).
export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (!(await canEditCommittee(session.user.id, session.user.role, "DISCIPLINE"))) {
    return NextResponse.json({ error: "管理員或訓育組長專屬功能" }, { status: 403 })
  }

  const data = upsertSchema.parse(await req.json())
  const saved = await prisma.homeroomClass.upsert({
    where:  { className: data.className },
    create: { ...data, teacherUserId: data.teacherUserId ?? null },
    update: { teacherName: data.teacherName, teacherEmail: data.teacherEmail, teacherUserId: data.teacherUserId ?? null },
  })

  return NextResponse.json(saved)
}

// DELETE — remove an assignment (admin / discipline chair). Body: { className }
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (!(await canEditCommittee(session.user.id, session.user.role, "DISCIPLINE"))) {
    return NextResponse.json({ error: "管理員或訓育組長專屬功能" }, { status: 403 })
  }

  const { className } = z.object({ className: z.string().min(1) }).parse(await req.json())
  await prisma.homeroomClass.deleteMany({ where: { className } })
  return NextResponse.json({ ok: true })
}
