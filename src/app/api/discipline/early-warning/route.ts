import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isTeacherOrAdmin, isAdmin } from "@/lib/roles"
import { prisma } from "@/lib/prisma"
import { BEHAVIOR_ORDER } from "@/lib/discipline"
import { hkMonthRange, hkPrevMonthRange } from "@/lib/hk-date"
import type { BehaviorType } from "@prisma/client"

// 行為預警 — who is trending badly THIS period.
//
// Complements /api/discipline/stats, which reports all-time totals with no
// date window: a student with 20 records from last September looks identical
// to one who picked up 5 last week. This compares the current period against
// the previous one so a deterioration surfaces before a threshold email fires.

const NEGATIVE_WEIGHT: Record<string, number> = {
  MAJOR_FAULT: 8,   // 大過
  MINOR_FAULT: 4,   // 小過
  DEMERIT:     2,   // 缺點
  MISCONDUCT:  2,   // legacy 違規
  ABSENT:      2,   // 缺席
  LATE:        1,   // 遲到
  MERIT:       0,   // 優點 — tracked, never counted as risk
}

function severityOf(counts: Record<string, number>): number {
  return Object.entries(counts).reduce((sum, [type, n]) => sum + (NEGATIVE_WEIGHT[type] ?? 1) * n, 0)
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  // Same gate as the existing discipline dashboard.
  if (!isAdmin(session.user.role)) {
    const r = await prisma.committeeRole.findFirst({
      where: { userId: session.user.id, committee: "DISCIPLINE" },
    })
    if (!r) return NextResponse.json({ error: "訓育組專屬功能" }, { status: 403 })
  }

  const url       = new URL(req.url)
  const className = url.searchParams.get("className") || undefined
  // Hong Kong month boundaries — the server is UTC, so plain date maths would
  // put every HK evening in the wrong month.
  const cur  = hkMonthRange()
  const prev = hkPrevMonthRange()

  const where = (from: Date, to: Date) => ({
    date: { gte: from, lt: to },
    ...(className ? { className: { contains: className, mode: "insensitive" as const } } : {}),
  })

  const [curRows, prevRows, allClasses] = await Promise.all([
    prisma.behaviorRecord.groupBy({
      by: ["className", "studentName", "type"], where: where(cur.start, cur.end), _count: { _all: true },
    }),
    prisma.behaviorRecord.groupBy({
      by: ["className", "studentName", "type"], where: where(prev.start, prev.end), _count: { _all: true },
    }),
    prisma.behaviorRecord.findMany({ select: { className: true }, distinct: ["className"] }),
  ])

  type Row = {
    className: string; studentName: string
    counts: Record<string, number>; negative: number; severity: number
    prevNegative: number; delta: number; unresolved: number
  }
  const rows = new Map<string, Row>()

  for (const g of curRows) {
    const key = `${g.className}||${g.studentName}`
    const row = rows.get(key) ?? {
      className: g.className, studentName: g.studentName,
      counts: {}, negative: 0, severity: 0, prevNegative: 0, delta: 0, unresolved: 0,
    }
    row.counts[g.type] = g._count._all
    if (g.type !== "MERIT") row.negative += g._count._all
    rows.set(key, row)
  }

  const prevNeg = new Map<string, number>()
  for (const g of prevRows) {
    if (g.type === "MERIT") continue
    const key = `${g.className}||${g.studentName}`
    prevNeg.set(key, (prevNeg.get(key) ?? 0) + g._count._all)
  }

  // Unresolved records carry extra weight — nobody has followed them up yet.
  const unresolved = await prisma.behaviorRecord.groupBy({
    by: ["className", "studentName"],
    where: { ...where(cur.start, cur.end), resolved: false, type: { not: "MERIT" } },
    _count: { _all: true },
  })
  for (const u of unresolved) {
    const row = rows.get(`${u.className}||${u.studentName}`)
    if (row) row.unresolved = u._count._all
  }

  rows.forEach((row, key) => {
    row.severity     = severityOf(row.counts)
    row.prevNegative = prevNeg.get(key) ?? 0
    row.delta        = row.negative - row.prevNegative
  })

  // Students who improved to zero this month won't appear at all — that's the
  // point: this view is about who needs attention now, not a full roll.
  const students = Array.from(rows.values())
    .filter((r) => r.negative > 0)
    .sort((a, b) => b.severity - a.severity || b.delta - a.delta)

  return NextResponse.json({
    order:   BEHAVIOR_ORDER as BehaviorType[],
    period:  { label: cur.label, prevLabel: prev.label },
    classes: Array.from(new Set(allClasses.map((c) => c.className))).sort(),
    students,
    totals: {
      flagged:     students.length,
      worsening:   students.filter((s) => s.delta > 0).length,
      unresolved:  students.reduce((n, s) => n + s.unresolved, 0),
    },
  })
}
