import { isTeacherOrAdmin } from "@/lib/roles"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const createSchema = z.object({
  date:        z.string(),
  className:   z.string().min(1).max(50),
  studentName: z.string().min(1).max(100),
  type:        z.enum(["MISCONDUCT", "MERIT"]),
  description: z.string().min(1),
  action:      z.string().optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !isTeacherOrAdmin(session.user.role) && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const resolved  = searchParams.get("resolved")
  const className = searchParams.get("className")
  const type      = searchParams.get("type") as "MISCONDUCT" | "MERIT" | null

  const records = await prisma.behaviorRecord.findMany({
    where: {
      authorId: session.user.id,
      ...(resolved === "true"  ? { resolved: true  } : {}),
      ...(resolved === "false" ? { resolved: false } : {}),
      ...(className ? { className: { contains: className, mode: "insensitive" } } : {}),
      ...(type      ? { type } : {}),
    },
    orderBy: { date: "desc" },
    include: { author: { select: { id: true, name: true } } },
  })

  return NextResponse.json(records)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !isTeacherOrAdmin(session.user.role) && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body   = await req.json()
  const data   = createSchema.parse(body)

  const record = await prisma.behaviorRecord.create({
    data: {
      ...data,
      date:     new Date(data.date),
      authorId: session.user.id,
    },
    include: { author: { select: { id: true, name: true } } },
  })

  return NextResponse.json(record, { status: 201 })
}
