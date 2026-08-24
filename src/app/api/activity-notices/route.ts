import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isTeacherOrAdmin, isAdmin } from "@/lib/roles"
import { prisma } from "@/lib/prisma"
import { NOTICE_COMMITTEES } from "@/lib/notice"
import { z } from "zod"

const NOTICE_LIST_SELECT = {
  id: true, title: true, committee: true, status: true,
  rejectionReason: true, calendarSynced: true, createdAt: true, updatedAt: true,
  createdBy:  { select: { id: true, name: true } },
  reviewedBy: { select: { id: true, name: true } },
} as const

// GET — ?scope=mine (default) my own notices, or ?scope=review for notices
// awaiting my sign-off (the committees I chair; everything for an admin).
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const scope = new URL(req.url).searchParams.get("scope") ?? "mine"

  if (scope === "review") {
    // Admins review anything; a chair reviews only their own committees.
    let where: Record<string, unknown> = { status: "PENDING" }
    if (!isAdmin(session.user.role)) {
      const chaired = await prisma.committeeRole.findMany({
        where:  { userId: session.user.id, isChair: true },
        select: { committee: true },
      })
      if (chaired.length === 0) return NextResponse.json({ notices: [] })
      where = { ...where, committee: { in: chaired.map((c) => c.committee) } }
    }
    const notices = await prisma.activityNotice.findMany({
      where, select: NOTICE_LIST_SELECT, orderBy: { updatedAt: "asc" },
    })
    return NextResponse.json({ notices })
  }

  const notices = await prisma.activityNotice.findMany({
    where:   { createdById: session.user.id },
    select:  NOTICE_LIST_SELECT,
    orderBy: { updatedAt: "desc" },
  })
  return NextResponse.json({ notices })
}

const createSchema = z.object({
  committee: z.enum(NOTICE_COMMITTEES as [string, ...string[]]).default("ECA"),
  payload:   z.record(z.unknown()),
})

// POST — save a new draft.
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || !isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { committee, payload } = createSchema.parse(await req.json())
  const title = String((payload as { activityName?: unknown }).activityName ?? "").trim()
  if (!title) return NextResponse.json({ error: "請先填寫活動名稱" }, { status: 400 })

  const notice = await prisma.activityNotice.create({
    data: {
      title,
      committee:   committee as never,
      payload:     payload as never,
      createdById: session.user.id,
    },
    select: NOTICE_LIST_SELECT,
  })

  return NextResponse.json(notice, { status: 201 })
}
