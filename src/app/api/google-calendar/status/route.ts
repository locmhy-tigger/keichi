/**
 * GET /api/google-calendar/status
 *
 * Returns the current Google Calendar connection status for the authenticated user.
 *
 * Response:
 *   {
 *     connected: boolean
 *     googleCalendarId?: string
 *     watchActive?: boolean
 *     watchExpiry?: string   // ISO date string
 *     syncedEventsCount?: number
 *     unsyncedEventsCount?: number
 *   }
 */

import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const conn = await prisma.googleCalendarConnection.findUnique({
    where: { userId: session.user.id },
    select: {
      googleCalendarId: true,
      watchChannelId:   true,
      watchExpiry:      true,
      updatedAt:        true,
    },
  })

  if (!conn) {
    return NextResponse.json({ connected: false })
  }

  // Count synced vs unsynced events for this user
  const [syncedCount, unsyncedCount] = await Promise.all([
    prisma.calendarEvent.count({
      where: { authorId: session.user.id, googleEventId: { not: null } },
    }),
    prisma.calendarEvent.count({
      where: { authorId: session.user.id, googleEventId: null },
    }),
  ])

  return NextResponse.json({
    connected:           true,
    googleCalendarId:    conn.googleCalendarId,
    watchActive:         !!conn.watchChannelId && (conn.watchExpiry ? conn.watchExpiry > new Date() : false),
    watchExpiry:         conn.watchExpiry?.toISOString() ?? null,
    lastSyncAt:          conn.updatedAt.toISOString(),
    syncedEventsCount:   syncedCount,
    unsyncedEventsCount: unsyncedCount,
  })
}
