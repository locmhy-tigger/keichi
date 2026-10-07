import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isTeacherOrAdmin } from "@/lib/roles"
import { requireClassAccess } from "@/lib/class-perm"
import { canRecordHomework } from "@/lib/class-rep"
import { loadRoster } from "@/lib/classroom-roster"
import { notifyMany } from "@/lib/notify"
import { hkDayStart, hkYmd } from "@/lib/hk-date"
import { dbErrorMessage } from "@/lib/db-error"
import { z } from "zod"

// 收功課: who has NOT handed in this homework.
//
// The teacher sets the homework in class; later the 課代表 collects it and
// ticks who is missing, against that same homework — nothing re-typed. Both
// the rep and the teacher work from this one list, so they always see the
// same thing, whoever recorded each miss.
//
// A rep sees only this: the roster and who missed THIS homework. Nothing else
// about classmates (absences, performance) is exposed.

type Params = { params: { classId: string; hwId: string } }
type User = { id: string; role: Parameters<typeof isTeacherOrAdmin>[0] }

async function authorise(params: Params["params"], user: User) {
  const hw = await prisma.homework.findFirst({
    where:  { id: params.hwId, classId: params.classId },
    select: {
      id: true, title: true, subject: true, byRole: true, recordedBy: true,
      class: { select: { id: true, name: true, teacherId: true, homeroomTeacherId: true } },
    },
  })
  if (!hw) return NextResponse.json({ error: "找不到功課" }, { status: 404 })
  if (isTeacherOrAdmin(user.role)) {
    const gate = await requireClassAccess(params.classId, { id: user.id, role: user.role })
    if (gate instanceof NextResponse) return gate
    return { hw, teacher: true }
  }
  if (!await canRecordHomework(params.classId, user.id, hw.subject)) {
    return NextResponse.json({ error: "只有此班的課代表可以收功課（科代表只限自己的科目）" }, { status: 403 })
  }
  return { hw, teacher: false }
}

async function missList(hwId: string, me: string) {
  const rows = await prisma.lessonRecord.findMany({
    where:  { homeworkId: hwId, kind: "MISSING_HOMEWORK" },
    select: { id: true, studentId: true, authorId: true, resolved: true, author: { select: { name: true, role: true } } },
  })
  return rows.map((r) => ({
    id: r.id, studentId: r.studentId, resolved: r.resolved,
    recordedBy: r.author.name, byRep: r.author.role === "STUDENT", mine: r.authorId === me,
  }))
}

// GET — the roster and who has missed this homework.
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const ok = await authorise(params, session.user)
  if (ok instanceof NextResponse) return ok
  try {
    const roster = await loadRoster(ok.hw.class.id, ok.hw.class.name)
    return NextResponse.json({
      homework: { id: ok.hw.id, title: ok.hw.title, subject: ok.hw.subject },
      roster:   roster.map((r) => ({ id: r.id, tag: r.tag, name: r.name ?? r.nameEn })),
      misses:   await missList(ok.hw.id, session.user.id),
    })
  } catch (err) {
    const msg = dbErrorMessage(err)
    return NextResponse.json({ error: msg ?? "未能載入" }, { status: msg ? 503 : 500 })
  }
}

const schema = z.object({
  studentIds: z.array(z.string().min(1)).min(1).max(60),
  /** Teachers only: tie the misses to the lesson they were noted in. */
  sessionId:  z.string().optional(),
})

// POST — record students as 欠交 for this homework. Already-recorded students
// are skipped, whoever recorded them.
export async function POST(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const ok = await authorise(params, session.user)
  if (ok instanceof NextResponse) return ok

  const parsed = schema.safeParse(await req.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: "請揀選學生" }, { status: 400 })

  try {
    const enrolled = await prisma.classEnrollment.findMany({
      where: { classId: params.classId, studentId: { in: parsed.data.studentIds } }, select: { studentId: true },
    })
    const already = new Set((await prisma.lessonRecord.findMany({
      where: { homeworkId: ok.hw.id, kind: "MISSING_HOMEWORK" }, select: { studentId: true },
    })).map((r) => r.studentId))
    const ids = enrolled.map((e) => e.studentId).filter((id) => !already.has(id))

    // A teacher marking misses in class ties them to that lesson; a rep
    // collecting at recess records them on the day, outside any lesson.
    const lesson = ok.teacher && parsed.data.sessionId
      ? await prisma.classroomSession.findFirst({
          where: { id: parsed.data.sessionId, classId: params.classId },
          select: { id: true, date: true, period: true },
        })
      : null

    await prisma.lessonRecord.createMany({
      data: ids.map((studentId) => ({
        classId: params.classId, studentId, kind: "MISSING_HOMEWORK" as const,
        sessionId: lesson?.id ?? null,
        date: lesson?.date ?? hkDayStart(hkYmd()),
        period: lesson?.period || null,
        subject: ok.hw.subject, homeworkId: ok.hw.id,
        authorId: session.user.id,
      })),
    })

    // A rep's record reaches the teacher who set the homework — or, for
    // homework a rep recorded, the class's teachers — rather than sitting
    // unseen until someone opens 回顧.
    if (!ok.teacher && ids.length) {
      const to = ok.hw.byRole === "TEACHER"
        ? [ok.hw.recordedBy]
        : Array.from(new Set([ok.hw.class.teacherId, ok.hw.class.homeroomTeacherId].filter((x): x is string => !!x)))
      await notifyMany(to, {
        type: "GENERAL",
        title: `課代表記錄了欠交：${ok.hw.class.name} ${ok.hw.title}（${ids.length} 人）`,
        link: `/teacher/classroom/${params.classId}`,
      })
    }

    return NextResponse.json({
      created: ids.length,
      alreadyRecorded: enrolled.length - ids.length,
      notInClass: parsed.data.studentIds.length - enrolled.length,
      misses: await missList(ok.hw.id, session.user.id),
    }, { status: 201 })
  } catch (err) {
    const msg = dbErrorMessage(err)
    console.error("[homework misses POST]", err)
    return NextResponse.json({ error: msg ?? "未能記錄" }, { status: msg ? 503 : 500 })
  }
}

// DELETE ?studentId= — they did hand it in after all. A rep may only undo what
// they recorded themselves, and not once a teacher has followed it up.
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const ok = await authorise(params, session.user)
  if (ok instanceof NextResponse) return ok

  const studentId = new URL(req.url).searchParams.get("studentId")
  if (!studentId) return NextResponse.json({ error: "缺少學生" }, { status: 400 })

  const rec = await prisma.lessonRecord.findFirst({
    where:  { homeworkId: ok.hw.id, kind: "MISSING_HOMEWORK", studentId },
    select: { id: true, authorId: true, resolved: true },
  })
  if (!rec) return NextResponse.json({ misses: await missList(ok.hw.id, session.user.id) })
  if (!ok.teacher && (rec.authorId !== session.user.id || rec.resolved)) {
    return NextResponse.json({ error: "只可以取消自己記錄、而老師未跟進的欠交" }, { status: 403 })
  }
  await prisma.lessonRecord.delete({ where: { id: rec.id } })
  return NextResponse.json({ misses: await missList(ok.hw.id, session.user.id) })
}
