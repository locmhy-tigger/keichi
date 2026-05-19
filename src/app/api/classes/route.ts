import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generateClassCode } from "@/lib/class-code"
import { z } from "zod"

const createSchema = z.object({ name: z.string().min(1).max(50) })

// GET — list my classes (teacher: owned, student: enrolled)
export async function GET() {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  if (session.user.role === "TEACHER") {
    const classes = await prisma.class.findMany({
      where: { teacherId: session.user.id },
      include: { _count: { select: { enrollments: true } } },
      orderBy: { createdAt: "desc" },
    })
    return NextResponse.json(classes)
  }

  const enrollments = await prisma.classEnrollment.findMany({
    where: { studentId: session.user.id },
    include: { class: { include: { teacher: { select: { name: true } } } } },
  })
  return NextResponse.json(enrollments.map((e) => e.class))
}

// POST — create class (teacher only)
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await req.json()
  const { name } = createSchema.parse(body)

  // Retry until unique code is generated
  let classCode: string
  let attempts = 0
  do {
    classCode = generateClassCode()
    attempts++
    const existing = await prisma.class.findUnique({ where: { classCode } })
    if (!existing) break
  } while (attempts < 10)

  const newClass = await prisma.class.create({
    data: { name, classCode: classCode!, teacherId: session.user.id },
  })

  return NextResponse.json(newClass, { status: 201 })
}
