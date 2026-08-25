import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isTeacherOrAdmin } from "@/lib/roles"
import { visibleRestrictedCommittees, RESTRICTED_COMMITTEES } from "@/lib/committee"
import type { CommitteeType } from "@prisma/client"

// Committees this user may TAG something with.
//
// Restricted ones (學生支援) are omitted unless the caller belongs to them —
// otherwise a teacher could tag an event with a committee and then be unable
// to see the thing they just created.

const LABELS: Record<CommitteeType, string> = {
  ADMIN:           "行政",
  DISCIPLINE:      "訓育",
  IT:              "資訊科技",
  CURRICULUM:      "課程發展",
  ECA:             "課外活動",
  STUDENT_SUPPORT: "學生支援",
  SCHOOL:          "學校活動及假期",
}

// Display order; SCHOOL sits last as the school-wide catch-all.
const ORDER: CommitteeType[] = [
  "ADMIN", "DISCIPLINE", "IT", "CURRICULUM", "ECA", "STUDENT_SUPPORT", "SCHOOL",
]

export async function GET() {
  const session = await auth()
  if (!session?.user || !isTeacherOrAdmin(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const allowed = await visibleRestrictedCommittees(session.user.id, session.user.role)
  const committees = ORDER
    .filter((c) => !RESTRICTED_COMMITTEES.includes(c) || allowed.includes(c))
    .map((value) => ({ value, label: LABELS[value] }))

  return NextResponse.json({ committees })
}
