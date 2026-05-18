import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

type RouteParams = { params: { classId: string } }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const cls = await prisma.class.findUnique({
    where: { id: params.classId },
    include: {
      teacher: { select: { id: true, name: true, image: true } },
      _count: { select: { enrollments: true, missions: true } },
    },
  })

  if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 })

  return NextResponse.json(cls)
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  const session = await auth()
  if (!session?.user || session.user.role !== "TEACHER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const cls = await prisma.class.findUnique({ where: { id: params.classId } })
  if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (cls.teacherId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  await prisma.class.delete({ where: { id: params.classId } })

  return new NextResponse(null, { status: 204 })
}
