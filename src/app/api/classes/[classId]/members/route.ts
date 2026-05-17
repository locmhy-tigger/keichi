import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type RouteParams = { params: { classId: string } }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const enrollments = await prisma.classEnrollment.findMany({
    where: { classId: params.classId },
    include: {
      student: { select: { id: true, name: true, image: true, email: true } },
    },
    orderBy: { student: { name: "asc" } },
  })

  return NextResponse.json(enrollments.map((e) => e.student))
}
