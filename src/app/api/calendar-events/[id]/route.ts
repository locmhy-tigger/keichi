import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdmin, canEditCommittee } from "@/lib/roles"
import { logToObsidian } from "@/lib/obsidian-log"
import {
  updateGoogleEvent,
  deleteGoogleEvent,
  isConnected,
  fanOutCommitteeEvent,
  retractCommitteeEvent,
} from "@/lib/google-calendar"
import { z } from "zod"

const patchSchema = z.object({
  title:       z.string().min(1).max(200).optional(),
  startDate:   z.string().optional(),
  endDate:     z.string().nullable().optional(),
  allDay:      z.boolean().optional(),
  description: z.string().optional(),
  committee:   z.enum(["ADMIN", "DISCIPLINE", "IT", "CURRICULUM", "ECA", "SCHOOL"]).nullable().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const event = await prisma.calendarEvent.findUnique({ where: { id: params.id } })
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Only a global ADMIN or the president (chair) of the event's committee may
  // edit it. Events with no committee (全校) are ADMIN-only.
  const allowed =
    isAdmin(session.user.role) ||
    (event.committee
      ? await canEditCommittee(session.user.id, session.user.role, event.committee)
      : false)
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const data    = patchSchema.parse(await req.json())
  const updated = await prisma.calendarEvent.update({
    where: { id: params.id },
    data: {
      ...data,
      ...(data.startDate ? { startDate: new Date(data.startDate) } : {}),
      ...(data.endDate !== undefined
        ? { endDate: data.endDate ? new Date(data.endDate) : null }
        : {}),
    },
    include: { author: { select: { id: true, name: true } } },
  })

  logToObsidian(
    "Calendar Event Updated",
    `Event "${updated.title}" (${updated.id}) updated by ${session.user.name}`
  )

  // Google Calendar sync — best-effort, non-blocking. Uses the event's
  // AUTHOR's own calendar (not the editor's) — a committee chair or admin
  // other than the author may be the one making this edit.
  isConnected(event.authorId)
    .then((connected) => {
      if (connected) return updateGoogleEvent(event.authorId, updated)
    })
    .catch((err) => console.error("[GCal] updateGoogleEvent error:", err))

  // Committee events fan out to every other relevant connected teacher.
  // If the committee changed, the old audience no longer needs a copy —
  // retract theirs, then fan out fresh to the new audience.
  if (event.committee !== updated.committee) {
    if (event.committee) {
      retractCommitteeEvent(updated.id).catch((err) => console.error("[GCal] retractCommitteeEvent error:", err))
    }
    if (updated.committee) {
      fanOutCommitteeEvent(updated).catch((err) => console.error("[GCal] fanOutCommitteeEvent error:", err))
    }
  } else if (updated.committee) {
    fanOutCommitteeEvent(updated).catch((err) => console.error("[GCal] fanOutCommitteeEvent error:", err))
  }

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const event = await prisma.calendarEvent.findUnique({ where: { id: params.id } })
  if (!event) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Only a global ADMIN or the president (chair) of the event's committee may
  // delete it. Events with no committee (全校) are ADMIN-only.
  const allowed =
    isAdmin(session.user.role) ||
    (event.committee
      ? await canEditCommittee(session.user.id, session.user.role, event.committee)
      : false)
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Capture Google sync fields before deletion — CalendarEventGoogleSync rows
  // cascade-delete along with the event, so fetch them first or we'd lose
  // track of which Google events to clean up in each recipient's calendar.
  const { googleEventId, authorId } = event
  const committeeSyncs = event.committee
    ? await prisma.calendarEventGoogleSync.findMany({
        where:  { calendarEventId: params.id },
        select: { userId: true, googleEventId: true },
      })
    : []

  await prisma.calendarEvent.delete({ where: { id: params.id } })

  logToObsidian(
    "Calendar Event Deleted",
    `Event "${event.title}" (${event.id}) deleted by ${session.user.name}`
  )

  // Google Calendar sync — best-effort, non-blocking. Uses the event's
  // AUTHOR's own calendar (not the deleter's) — a committee chair or admin
  // other than the author may be the one deleting it.
  if (googleEventId) {
    isConnected(authorId)
      .then(async (connected) => {
        if (!connected) return
        const conn = await prisma.googleCalendarConnection.findUnique({
          where:  { userId: authorId },
          select: { googleCalendarId: true },
        })
        if (conn) {
          await deleteGoogleEvent(authorId, googleEventId, conn.googleCalendarId)
        }
      })
      .catch((err) => console.error("[GCal] deleteGoogleEvent error:", err))
  }

  // Committee events — clean up every fanned-out copy too
  if (committeeSyncs.length > 0) {
    retractCommitteeEvent(params.id, committeeSyncs).catch((err) => console.error("[GCal] retractCommitteeEvent error:", err))
  }

  return NextResponse.json({ deleted: true })
}
