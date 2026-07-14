// @deprecated 舊版「班級管理」API（HomeroomClass / HomeroomStudent）。
// 班級 / 班主任 / 學生成員已改用 Class + ClassEnrollment（CLASS MANAGEMENT schema 區）。
// 本 API 僅被已隱藏的 /teacher/admin/homeroom page 使用。請勿擴充。
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/roles"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

// GET — full class list with rosters + student counts (admin management page).
export async function GET() {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const classes = await prisma.homeroomClass.findMany({
    orderBy: { className: "asc" },
    include: {
      students: { orderBy: [{ classNumber: "asc" }, { studentName: "asc" }] },
      _count:   { select: { students: true } },
    },
  })

  return NextResponse.json({ classes })
}

const upsertSchema = z.object({
  className:    z.string().min(1).max(50),
  teacherName:  z.string().min(1).max(100),
  teacherEmail: z.string().email(),
})

// PUT — create/update a class (name + 班主任 + email). Admin only.
export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const data = upsertSchema.parse(await req.json())
  const saved = await prisma.homeroomClass.upsert({
    where:  { className: data.className },
    create: data,
    update: { teacherName: data.teacherName, teacherEmail: data.teacherEmail },
    include: { _count: { select: { students: true } }, students: true },
  })

  return NextResponse.json(saved)
}

// DELETE — remove a class (+ its roster via cascade). Body: { className }
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { className } = z.object({ className: z.string().min(1) }).parse(await req.json())
  await prisma.homeroomClass.deleteMany({ where: { className } })
  return NextResponse.json({ ok: true })
}
