import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isTeacherOrAdmin } from "@/lib/roles"
import { prisma } from "@/lib/prisma"
import { RESOURCE_CATEGORIES } from "@/lib/resource"
import { z } from "zod"

// AI 教學資源 — shared link library. Same shape as the prompt library:
// any teacher may add; edit/delete is restricted to the creator or an admin
// (see [id]/route.ts).

const SELECT = {
  id: true, title: true, url: true, description: true,
  category: true, tags: true, createdById: true, createdAt: true,
  createdBy: { select: { id: true, name: true } },
} as const

export async function GET() {
  const session = await auth()
  if (!session?.user || !isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const resources = await prisma.teachingResource.findMany({
    select:  SELECT,
    orderBy: { createdAt: "desc" },
  })
  return NextResponse.json({ resources })
}

const createSchema = z.object({
  title:       z.string().min(1).max(200),
  url:         z.string().url().max(2000),
  description: z.string().max(1000).optional(),
  category:    z.enum(RESOURCE_CATEGORIES).default("OTHER"),
  tags:        z.array(z.string().max(30)).max(20).default([]),
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const data = createSchema.parse(await req.json())

  // Only http(s) — a javascript: or data: URL here would be rendered as a link
  // for every other teacher.
  if (!/^https?:\/\//i.test(data.url)) {
    return NextResponse.json({ error: "連結必須以 http:// 或 https:// 開頭" }, { status: 400 })
  }

  const resource = await prisma.teachingResource.create({
    data: { ...data, createdById: session.user.id },
    select: SELECT,
  })
  return NextResponse.json(resource, { status: 201 })
}
