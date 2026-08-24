import { isTeacherOrAdmin } from "@/lib/roles"
import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"
import { findClashes, windowOf, clashTitleMap } from "@/lib/clash"

const createSchema = z.object({
  title:       z.string().min(1).max(200),
  description: z.string().optional(),
  startTime:   z.string().datetime(),
  endTime:     z.string().datetime().optional(),
  location:    z.string().max(200).optional(),
  committee:   z.enum(["ADMIN", "DISCIPLINE", "IT", "CURRICULUM", "ECA", "STUDENT_SUPPORT"]).optional(),
  activityType: z.enum(["ECA", "ACADEMIC"]).optional(),
  studentList: z.string().optional(), // Legacy: raw text, one name/email per line
  // Preferred: already-resolved student account ids from the roster grid
  // (see /api/students/resolve). Takes precedence over studentList.
  studentIds:  z.array(z.string()).max(500).optional(),
})

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // STUDENT：只看分配給自己的活動
  if (session.user.role === "STUDENT") {
    const studentActivities = await prisma.activity.findMany({
      where: {
        assignments: { some: { studentId: session.user.id } }
      },
      include: {
        assignments: {
          where: { studentId: session.user.id },
          select: { status: true, note: true }
        },
        createdBy: { select: { id: true, name: true } }
      },
      orderBy: { startTime: "asc" },
    })
    return NextResponse.json(studentActivities)
  }

  // TEACHER：自己建立的活動；ADMIN：全部活動
  const where = session.user.role === "ADMIN" ? {} : { createdById: session.user.id }

  // ?withStudents=1 — the 活動總覽 hub needs each participant's class to offer
  // 按班別 / 按學生 views. Kept opt-in so other callers keep the light payload.
  const withStudents = new URL(req.url).searchParams.get("withStudents") === "1"

  const activities = await prisma.activity.findMany({
    where,
    include: {
      _count: { select: { assignments: true } },
      assignments: withStudents
        ? {
            select: {
              id: true, status: true, note: true,
              student: {
                select: {
                  id: true, name: true,
                  // Usually one or two rows; the UI picks the form class.
                  enrollments: {
                    select: { classNumber: true, class: { select: { name: true } } },
                  },
                },
              },
            },
          }
        : { where: { status: "CONFIRMED" }, select: { id: true } },
    },
    orderBy: { startTime: "asc" },
  })
  return NextResponse.json(activities)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isTeacherOrAdmin(session.user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) }

  let data: ReturnType<typeof createSchema.parse>
  try { data = createSchema.parse(body) } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Validation error"
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const { studentList, studentIds } = data

  const activity = await prisma.activity.create({
    data: {
      title:       data.title,
      description: data.description,
      startTime:   new Date(data.startTime),
      endTime:     data.endTime ? new Date(data.endTime) : undefined,
      location:     data.location,
      committee:    data.committee,
      activityType: data.activityType,
      createdById:  session.user.id,
    },
    include: {
      _count:      { select: { assignments: true } },
      assignments: { where: { status: "CONFIRMED" }, select: { id: true } },
    },
  })

  // Assign students. Prefer studentIds (already resolved by the roster grid
  // via /api/students/resolve); fall back to the legacy name/email text list.
  if (studentIds?.length || studentList) {
    {
      const resolvedUsers = studentIds?.length
        ? await prisma.user.findMany({
            where:  { id: { in: studentIds }, role: "STUDENT" },
            select: { id: true, name: true },
          })
        : await prisma.user.findMany({
            where: {
              OR: [
                { email: { in: studentList!.split(/\r?\n/).map(l => l.trim()).filter(Boolean) } },
                { name:  { in: studentList!.split(/\r?\n/).map(l => l.trim()).filter(Boolean) } },
              ],
              role: "STUDENT",
            },
            select: { id: true, name: true },
          })

      if (resolvedUsers.length > 0) {
        const targetStudentIds = resolvedUsers.map(u => u.id)

        // Shared helper: handles activities saved with a NULL endTime, which
        // the old inline query silently skipped (SQL NULL never matches `gt`).
        const hits = await findClashes(
          targetStudentIds,
          [windowOf(activity.startTime, activity.endTime)],
          activity.id,
        )
        const clashMap = clashTitleMap(hits)

        // Assign all
        await prisma.activityAssignment.createMany({
          data: resolvedUsers.map(user => {
            const clashTitle = clashMap.get(user.id)
            return {
              activityId: activity.id,
              studentId:  user.id,
              status:     clashTitle ? "PENDING" : "CONFIRMED" as any,
              note:       clashTitle ? `時間衝突：與「${clashTitle}」重疊` : null
            }
          }),
          skipDuplicates: true
        })
      }
    }
  }

  return NextResponse.json(activity, { status: 201 })
}
