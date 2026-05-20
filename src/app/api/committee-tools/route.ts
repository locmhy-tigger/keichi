import { isTeacherOrAdmin } from "@/lib/roles"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  committee:   z.enum(["ADMIN", "DISCIPLINE", "IT", "CURRICULUM"]),
  label:       z.string().min(1).max(100),
  description: z.string().max(300).optional(),
  type:        z.enum(["LINK", "EMBED", "HTML", "GOOGLE_SHEET"]),
  content:     z.string().min(1),
  order:       z.number().int().default(0),
  active:      z.boolean().default(true),
})

async function canEdit(userId: string, committee: string): Promise<boolean> {
  const role = await prisma.committeeRole.findFirst({
    where: {
      userId,
      OR: [
        { committee: committee as "ADMIN" | "DISCIPLINE" | "IT" | "CURRICULUM" },
        { committee: "ADMIN" },
      ],
    },
  })
  return !!role
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const committee = new URL(req.url).searchParams.get("committee")
  const isAdmin   = session.user.role === "TEACHER"

  const tools = await prisma.committeeTool.findMany({
    where: {
      ...(committee ? { committee: committee as "ADMIN" | "DISCIPLINE" | "IT" | "CURRICULUM" } : {}),
      ...(!isAdmin ? { active: true } : {}),
    },
    orderBy: { order: "asc" },
    include: { createdBy: { select: { id: true, name: true } } },
  })

  return NextResponse.json(tools)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isTeacherOrAdmin(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const data = createSchema.parse(await req.json())

  if (!(await canEdit(session.user.id, data.committee))) {
    return NextResponse.json({ error: "Only committee members or admins can add tools" }, { status: 403 })
  }

  const tool = await prisma.committeeTool.create({
    data: { ...data, createdById: session.user.id },
    include: { createdBy: { select: { id: true, name: true } } },
  })

  return NextResponse.json(tool, { status: 201 })
}
