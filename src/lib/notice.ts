import type { CommitteeType } from "@prisma/client"

// Shape of ActivityNotice.payload — the activity-docs form state, stored
// verbatim so /api/activity-docs/generate keeps accepting it unchanged.
export type NoticeSession = {
  date:          string
  time?:         string
  location?:     string
  activityName?: string
  arriveTime?:   string
  leaveTime?:    string
}

export type NoticeStudent = { className: string; studentId: string; name: string }

export type NoticePayload = {
  activityName: string
  sessions?:    NoticeSession[]
  students?:    NoticeStudent[]
  [key: string]: unknown
}

export const NOTICE_COMMITTEES: CommitteeType[] = ["ADMIN", "DISCIPLINE", "IT", "CURRICULUM", "ECA"]

/** Local wall-clock Date from "YYYY-MM-DD" + optional "HH:MM" (Asia/Hong_Kong server assumed). */
export function sessionStart(s: NoticeSession): Date | null {
  if (!s.date) return null
  const t = /^\d{1,2}:\d{2}$/.test(s.arriveTime ?? "") ? s.arriveTime! : "00:00"
  const d = new Date(`${s.date}T${t.padStart(5, "0")}:00`)
  return isNaN(d.getTime()) ? null : d
}
