// @deprecated 舊版「班級管理」學生名單 API（HomeroomStudent）。
// 班級學生成員已改用 ClassEnrollment（透過 classCode 加入的 User）。
// 本 API 僅被已隱藏的 /teacher/admin/homeroom page 使用。請勿擴充。
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdmin } from "@/lib/roles"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const MAX_STUDENTS = 100

const putSchema = z.object({
  className: z.string().min(1),
  // Append these students to the class roster (dedup by name).
  students: z.array(z.object({
    studentName: z.string().min(1).max(100),
    classNumber: z.string().max(20).optional(),
  })).min(1).max(MAX_STUDENTS),
})

// PUT — add students to a class roster (manual add or CSV import). Admin only.
export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { className, students } = putSchema.parse(await req.json())

  const cls = await prisma.homeroomClass.findUnique({ where: { className } })
  if (!cls) return NextResponse.json({ error: "找不到班別，請先建立。" }, { status: 404 })

  await prisma.homeroomStudent.createMany({
    data: students.map((s) => ({
      homeroomClassId: cls.id,
      studentName:     s.studentName.trim(),
      classNumber:     s.classNumber?.trim() || null,
    })),
    skipDuplicates: true,
  })

  const updated = await prisma.homeroomStudent.findMany({
    where:   { homeroomClassId: cls.id },
    orderBy: [{ classNumber: "asc" }, { studentName: "asc" }],
  })

  return NextResponse.json({ students: updated })
}

// DELETE — remove one student from a class. Body: { className, studentName }
export async function DELETE(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { className, studentName } = z.object({
    className: z.string().min(1), studentName: z.string().min(1),
  }).parse(await req.json())

  const cls = await prisma.homeroomClass.findUnique({ where: { className } })
  if (!cls) return NextResponse.json({ error: "找不到班別" }, { status: 404 })

  await prisma.homeroomStudent.deleteMany({ where: { homeroomClassId: cls.id, studentName } })
  return NextResponse.json({ ok: true })
}
