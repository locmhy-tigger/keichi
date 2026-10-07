import { prisma } from "@/lib/prisma"

// 課代表／科代表. Authorisation is always server-side against the ClassRep
// table — never a client flag.

/** null = not a rep of this class; [""] = 全科; ["中文"] = that subject only. */
export async function repSubjects(classId: string, userId: string): Promise<string[] | null> {
  const rows = await prisma.classRep.findMany({ where: { classId, studentId: userId }, select: { subject: true } })
  return rows.length ? rows.map((r) => r.subject) : null
}

/**
 * May this student record homework for this class and subject? A 全科 rep may
 * record anything; a 中文科代表 only 中文 — checked here so it can't be bypassed
 * by posting straight to the API.
 */
export async function canRecordHomework(classId: string, userId: string, subject: string | null): Promise<boolean> {
  const subjects = await repSubjects(classId, userId)
  if (!subjects) return false
  if (subjects.includes("")) return true
  return !!subject && subjects.includes(subject.trim())
}
