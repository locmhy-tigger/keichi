import { prisma } from "@/lib/prisma"
import { getAllTeachers, matchTeacher } from "@/lib/agent-timetable"

// Bridging a User account to a timetable row.
//
// AgentTimetable is keyed by free text (「盧智明」) while accounts may hold a
// Chinese name, an English name (LO CHI MING), or both. Resolution order:
//   1. timetableName — an explicit override an admin set, always wins
//   2. name  (中文姓名)
//   3. nameEn (英文姓名)
// each tried through matchTeacher's fuzzy matching (which strips 老師/sir/miss).

export type TeacherResolution =
  | { ok: true;  timetableName: string; via: "override" | "name" | "nameEn" }
  | { ok: false; tried: string[] }

export function resolveAgainstTimetable(
  user: { name: string | null; nameEn: string | null; timetableName: string | null },
  allTimetableNames: string[],
): TeacherResolution {
  const attempts: { value: string | null; via: "override" | "name" | "nameEn" }[] = [
    { value: user.timetableName, via: "override" },
    { value: user.name,          via: "name"     },
    { value: user.nameEn,        via: "nameEn"   },
  ]

  const tried: string[] = []
  for (const a of attempts) {
    const v = a.value?.trim()
    if (!v) continue
    tried.push(v)
    // An explicit override is authoritative — take an exact hit without fuzz.
    if (a.via === "override" && allTimetableNames.includes(v)) {
      return { ok: true, timetableName: v, via: "override" }
    }
    const m = matchTeacher(v, allTimetableNames)
    if (m.matched) return { ok: true, timetableName: m.matched, via: a.via }
  }
  return { ok: false, tried }
}

/** Which staff accounts currently fail to match a timetable row. */
export async function unmatchedTeachers(term: string) {
  const [staff, names] = await Promise.all([
    prisma.user.findMany({
      where:  { role: { in: ["TEACHER", "ADMIN"] } },
      select: { id: true, name: true, nameEn: true, timetableName: true, email: true },
    }),
    getAllTeachers(term),
  ])
  return staff
    .map((u) => ({ user: u, res: resolveAgainstTimetable(u, names) }))
    .filter((x) => !x.res.ok)
    .map((x) => ({ ...x.user, tried: (x.res as { tried: string[] }).tried }))
}
