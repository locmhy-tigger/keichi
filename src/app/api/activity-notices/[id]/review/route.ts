import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isTeacherOrAdmin, canEditCommittee } from "@/lib/roles"
import { prisma } from "@/lib/prisma"
import { notify } from "@/lib/notify"
import { fanOutCommitteeEvent, createGoogleEvent, isConnected } from "@/lib/google-calendar"
import type { NoticePayload, NoticeSession } from "@/lib/notice"
import { z } from "zod"

const schema = z.object({
  action:          z.enum(["approve", "reject"]),
  rejectionReason: z.string().max(1000).optional(),
})

// POST — chair of the notice's committee (or any admin) approves/rejects.
// Approving is what puts the activity on the school calendar.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user || !isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const notice = await prisma.activityNotice.findUnique({ where: { id: params.id } })
  if (!notice) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // canEditCommittee is exactly the rule wanted: that committee's chair, or admin.
  if (!(await canEditCommittee(session.user.id, session.user.role, notice.committee))) {
    return NextResponse.json({ error: "只有該組別主席或管理員可批核" }, { status: 403 })
  }
  if (notice.status !== "PENDING") {
    return NextResponse.json({ error: "此通告並非待批核狀態" }, { status: 409 })
  }

  const { action, rejectionReason } = schema.parse(await req.json())

  if (action === "reject") {
    if (!rejectionReason?.trim()) {
      return NextResponse.json({ error: "請填寫退回原因" }, { status: 400 })
    }
    const updated = await prisma.activityNotice.update({
      where: { id: params.id },
      data: {
        status: "REJECTED", rejectionReason: rejectionReason.trim(),
        reviewedById: session.user.id, reviewedAt: new Date(),
      },
    })
    await notify({
      userId: notice.createdById,
      type:   "DOC_APPROVAL",
      title:  `通告被退回：${notice.title}`,
      body:   rejectionReason.trim(),
      link:   `/teacher/committee/admin/activity-docs?id=${notice.id}`,
    })
    return NextResponse.json(updated)
  }

  // ── Approve ──────────────────────────────────────────────────────────────
  const payload  = notice.payload as unknown as NoticePayload
  const sessions = Array.isArray(payload?.sessions) ? payload.sessions : []

  let createdCount = 0
  // calendarSynced guards re-approval (only reachable if a notice were ever
  // reopened) from creating a second set of events.
  if (!notice.calendarSynced) {
    for (const s of sessions as NoticeSession[]) {
      if (!s?.date) continue
      const start = new Date(`${s.date}T00:00:00`)
      if (isNaN(start.getTime())) continue

      // CalendarEvent has no location column — fold time + venue into the notes.
      const parts = [s.time, s.location].filter(Boolean)
      const event = await prisma.calendarEvent.create({
        data: {
          title:       (s.activityName?.trim() || notice.title),
          startDate:   start,
          allDay:      true,
          committee:   notice.committee,
          description: parts.length ? parts.join(" · ") : null,
          authorId:    notice.createdById,
        },
      })
      createdCount++

      // Mirror what POST /api/calendar-events does, so approved events reach
      // Google Calendar the same way a hand-made one would.
      try {
        if (await isConnected(notice.createdById)) await createGoogleEvent(notice.createdById, event)
        await fanOutCommitteeEvent(event)
      } catch (err) {
        console.error("[notice] calendar sync failed:", err)
      }
    }
  }

  const updated = await prisma.activityNotice.update({
    where: { id: params.id },
    data: {
      status: "APPROVED", rejectionReason: null,
      reviewedById: session.user.id, reviewedAt: new Date(),
      calendarSynced: true,
    },
  })

  await notify({
    userId: notice.createdById,
    type:   "DOC_APPROVAL",
    title:  `通告已批核：${notice.title}`,
    body:   createdCount > 0 ? `已加入 ${createdCount} 個活動到行事曆` : "已批核",
    link:   `/teacher/committee/admin/activity-docs?id=${notice.id}`,
  })

  return NextResponse.json({ ...updated, calendarEventsCreated: createdCount })
}
