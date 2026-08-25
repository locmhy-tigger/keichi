import { prisma } from "@/lib/prisma"

// Shared activity time-clash detection.
//
// Replaces three near-duplicate implementations that all filtered on
// `endTime: { gt: ... }` — which in SQL never matches NULL, so any activity
// saved without an end time was invisible to clash detection. Here the window
// is computed in JS with the `endTime ?? start + 1h` fallback that
// src/lib/activity-suggest.ts already got right.

const DEFAULT_DURATION_MS = 60 * 60 * 1000

export type Window = { start: Date; end: Date }

export function windowOf(startTime: Date, endTime: Date | null): Window {
  return { start: startTime, end: endTime ?? new Date(startTime.getTime() + DEFAULT_DURATION_MS) }
}

/** Half-open overlap: touching edges (a ends exactly when b starts) do not clash. */
export function overlaps(a: Window, b: Window): boolean {
  return a.start < b.end && a.end > b.start
}

export type ClashHit = { studentId: string; activityId: string; title: string; startTime: Date }

/**
 * For each student, find activities overlapping ANY of the given windows.
 * `excludeActivityId` skips the activity being created/edited.
 */
export async function findClashes(
  studentIds: string[],
  windows: Window[],
  excludeActivityId?: string,
): Promise<ClashHit[]> {
  if (studentIds.length === 0 || windows.length === 0) return []

  // Fetch once over the whole span, then narrow per-window in JS so NULL
  // endTimes are handled correctly.
  const spanStart = new Date(Math.min(...windows.map((w) => w.start.getTime())))
  const spanEnd   = new Date(Math.max(...windows.map((w) => w.end.getTime())))

  const rows = await prisma.activityAssignment.findMany({
    where: {
      studentId: { in: studentIds },
      activity: {
        ...(excludeActivityId ? { id: { not: excludeActivityId } } : {}),
        startTime: { lt: spanEnd },
      },
    },
    select: {
      studentId: true,
      activity: { select: { id: true, title: true, startTime: true, endTime: true } },
    },
  })

  const hits: ClashHit[] = []
  for (const r of rows) {
    const w = windowOf(r.activity.startTime, r.activity.endTime)
    if (w.end <= spanStart) continue
    if (windows.some((win) => overlaps(w, win))) {
      hits.push({
        studentId: r.studentId,
        activityId: r.activity.id,
        title: r.activity.title,
        startTime: r.activity.startTime,
      })
    }
  }
  return hits
}

/** studentId → first clashing activity title, for the PENDING/note treatment. */
export function clashTitleMap(hits: ClashHit[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const h of hits) if (!m.has(h.studentId)) m.set(h.studentId, h.title)
  return m
}
