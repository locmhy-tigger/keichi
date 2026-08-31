/**
 * POST /api/google-calendar/webhook
 *
 * Receives Google Calendar Push Notifications (Watch API).
 *
 * Google sends a POST with headers:
 *   X-Goog-Channel-ID:    the channelId we registered (= watchChannelId in DB)
 *   X-Goog-Resource-ID:   the resourceId (calendar ID on Google's side)
 *   X-Goog-Resource-State: "sync" (initial confirmation) | "exists" (change)
 *   X-Goog-Message-Number: incrementing counter
 *
 * We do NOT verify a shared secret here (Google doesn't sign push notifications
 * with HMAC), so the security model is:
 *   - We look up the channelId in DB — if it doesn't match any known connection,
 *     we return 200 silently (avoid leaking info).
 *   - The actual data pull uses the stored refresh_token, so even a spoofed
 *     notification just triggers a harmless incremental sync.
 *
 * On receiving "exists":
 *   1. Look up the user by watchChannelId
 *   2. Run incremental sync (processIncrementalSync)
 *   3. Renew watch channel if expiring soon
 *   4. Return 200 immediately (Google expects quick response)
 */

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { processIncrementalSync, renewWatchIfNeeded } from "@/lib/google-calendar"

export async function POST(req: NextRequest) {
  const channelId     = req.headers.get("x-goog-channel-id")
  const resourceState = req.headers.get("x-goog-resource-state")
  const messageNum    = req.headers.get("x-goog-message-number")

  // Always return 200 quickly — Google will retry if we return non-2xx
  if (!channelId) {
    return new NextResponse(null, { status: 200 })
  }

  // "sync" is a confirmation ping after we subscribe — nothing to do
  if (resourceState === "sync") {
    console.log(`[GCal webhook] sync confirmation for channel ${channelId} (msg#${messageNum})`)
    return new NextResponse(null, { status: 200 })
  }

  // "exists" means something changed in the calendar
  if (resourceState === "exists") {
    // Look up which user this channel belongs to
    const conn = await prisma.googleCalendarConnection.findUnique({
      where:  { watchChannelId: channelId },
      select: { userId: true, watchExpiry: true },
    })

    if (!conn) {
      // Unknown channel — could be a stale channel from before a reconnect. Ignore.
      console.warn(`[GCal webhook] unknown channelId: ${channelId}`)
      return new NextResponse(null, { status: 200 })
    }

    // Process sync asynchronously — we must return 200 ASAP to Google
    // Using Promise without await is intentional: Next.js will keep the
    // serverless function alive until the promise resolves before the response
    // is sent (in practice this is fine for short operations).
    processIncrementalSync(conn.userId)
      .then((count) => {
        if (count > 0) {
          console.log(`[GCal webhook] synced ${count} events for user ${conn.userId}`)
        }
      })
      .catch((err) => console.error("[GCal webhook] sync error:", err))

    renewWatchIfNeeded(conn.userId).catch((err) =>
      console.error("[GCal webhook] renew watch error:", err),
    )
  }

  return new NextResponse(null, { status: 200 })
}

// Google sends HEAD requests occasionally to verify the endpoint is alive
export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}
