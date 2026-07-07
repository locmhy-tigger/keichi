import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isTeacherOrAdmin, canEditCommittee } from "@/lib/roles"
import { prisma } from "@/lib/prisma"
import { BEHAVIOR_ORDER } from "@/lib/discipline"
import type { BehaviorType } from "@prisma/client"
import { z } from "zod"

// GET — all category thresholds (fills in defaults for categories with no row).
export async function GET() {
  const session = await auth()
  if (!session?.user || !isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const existing = await prisma.disciplineThreshold.findMany()
  const byCat = new Map(existing.map((t) => [t.category, t]))

  const thresholds = BEHAVIOR_ORDER
    .filter((c) => c !== "MERIT") // thresholds only meaningful for negatives
    .map((category) => {
      const t = byCat.get(category)
      return {
        category,
        threshold: t?.threshold ?? 5,
        enabled:   t?.enabled ?? false,
      }
    })

  return NextResponse.json({ thresholds })
}

const putSchema = z.object({
  thresholds: z.array(z.object({
    category:  z.enum(["MISCONDUCT", "DEMERIT", "MINOR_FAULT", "MAJOR_FAULT", "LATE", "ABSENT"]),
    threshold: z.number().int().min(1).max(100),
    enabled:   z.boolean(),
  })),
})

// PUT — upsert thresholds (admin / discipline chair).
export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (!(await canEditCommittee(session.user.id, session.user.role, "DISCIPLINE"))) {
    return NextResponse.json({ error: "管理員或訓育組長專屬功能" }, { status: 403 })
  }

  const { thresholds } = putSchema.parse(await req.json())

  await prisma.$transaction(
    thresholds.map((t) =>
      prisma.disciplineThreshold.upsert({
        where:  { category: t.category as BehaviorType },
        create: { category: t.category as BehaviorType, threshold: t.threshold, enabled: t.enabled },
        update: { threshold: t.threshold, enabled: t.enabled },
      })
    )
  )

  return NextResponse.json({ ok: true })
}
