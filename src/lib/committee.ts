import type { CommitteeType, Role } from "@prisma/client"
import { prisma } from "@/lib/prisma"

// ─────────────────────────────────────────────────────────────
// Committee visibility
//
// Most committees are open: any staff member can see their calendar events.
// RESTRICTED ones are private — visible only to admins, the committee's own
// CommitteeRole members, and members of a StudentGroup tagged with it. That
// includes hiding them from OTHER TEACHERS, which no other category does.
// ─────────────────────────────────────────────────────────────

export const RESTRICTED_COMMITTEES: CommitteeType[] = ["STUDENT_SUPPORT"]

export function isRestrictedCommittee(c: CommitteeType | null | undefined): boolean {
  return !!c && RESTRICTED_COMMITTEES.includes(c)
}

/** Restricted committees this user may see (empty unless they're a member somewhere). */
export async function visibleRestrictedCommittees(
  userId: string,
  role: Role | undefined,
): Promise<CommitteeType[]> {
  if (role === "ADMIN") return RESTRICTED_COMMITTEES

  const [roles, groups] = await Promise.all([
    prisma.committeeRole.findMany({
      where:  { userId, committee: { in: RESTRICTED_COMMITTEES } },
      select: { committee: true },
    }),
    // Group membership is the second route in — a student in a 學生支援 group
    // sees that calendar without needing a CommitteeRole.
    prisma.studentGroup.findMany({
      where:  { committee: { in: RESTRICTED_COMMITTEES }, members: { some: { userId } } },
      select: { committee: true },
    }),
  ])

  const set = new Set<CommitteeType>()
  for (const r of roles)  if (r.committee) set.add(r.committee)
  for (const g of groups) if (g.committee) set.add(g.committee)
  return Array.from(set)
}

/** True when this user may see events in `committee`. */
export async function canSeeCommittee(
  userId: string,
  role: Role | undefined,
  committee: CommitteeType | null,
): Promise<boolean> {
  if (!isRestrictedCommittee(committee)) return true
  const allowed = await visibleRestrictedCommittees(userId, role)
  return allowed.includes(committee as CommitteeType)
}

/**
 * Prisma `where` fragment limiting calendar events to what this user may see.
 * Students are additionally capped to school-wide + 課外活動.
 */
export async function calendarVisibilityWhere(userId: string, role: Role | undefined) {
  const allowedRestricted = await visibleRestrictedCommittees(userId, role)

  if (role === "STUDENT") {
    const base: CommitteeType[] = ["SCHOOL", "ECA"]
    return { committee: { in: [...base, ...allowedRestricted] } }
  }

  // Staff see everything except restricted committees they don't belong to.
  const hidden = RESTRICTED_COMMITTEES.filter((c) => !allowedRestricted.includes(c))
  if (hidden.length === 0) return {}
  return {
    OR: [
      { committee: null },
      { committee: { notIn: hidden } },
    ],
  }
}
